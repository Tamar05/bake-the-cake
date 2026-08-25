import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import { translateText } from '../lib/translationApi';
import { reserveRequest, releaseRequest } from '../lib/requestsApi';
import { fieldNeedsTranslation } from '../lib/detectLanguage';

type Props = {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
  onUpdated: (updated: CakeRequest) => void;
};

type Mode = 'original' | 'translated';
type TranslateStatus = 'idle' | 'loading' | 'error';
type ReserveStatus = 'idle' | 'saving' | 'error' | 'missing';
type ReleaseStatus = 'idle' | 'saving' | 'error';

// The four typed-in text fields we may translate (the date is never translated).
type Translated = {
  recipient: string;
  occasion: string;
  dietary: string;
  location: string;
};
const TEXT_FIELDS = ['recipient', 'occasion', 'dietary', 'location'] as const;

export default function RequestCard({ t, language, request, onUpdated }: Props) {
  const [mode, setMode] = useState<Mode>('original');
  const [translateStatus, setTranslateStatus] = useState<TranslateStatus>('idle');
  const [translated, setTranslated] = useState<Translated | null>(null);

  const [reserveOpen, setReserveOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [reserveStatus, setReserveStatus] = useState<ReserveStatus>('idle');
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus>('idle');

  // A once-a-second clock, running only while this request is reserved, so the
  // countdown ticks and the card flips back to Open on its own when it expires.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (request.status !== 'reserved' || request.reservedUntil == null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [request.status, request.reservedUntil]);

  const isReserved =
    request.status === 'reserved' && request.reservedUntil != null && request.reservedUntil > now;

  // Switching the language selector makes any earlier translation stale (its
  // target language changed), so start this card fresh in its original text.
  useEffect(() => {
    setMode('original');
    setTranslateStatus('idle');
    setTranslated(null);
  }, [language]);

  // Show the Translate button only when at least one field is in a language
  // other than the one being read — otherwise the card is already readable.
  const needsTranslation = TEXT_FIELDS.some((field) =>
    fieldNeedsTranslation(request[field], language),
  );

  async function handleTranslateClick() {
    if (mode === 'translated') {
      setMode('original');
      return;
    }
    if (translated) {
      setMode('translated');
      return;
    }
    // First time → translate only the fields that aren't already in the
    // selected language; leave the rest exactly as they were typed.
    setTranslateStatus('loading');
    const next: Translated = {
      recipient: request.recipient,
      occasion: request.occasion,
      dietary: request.dietary,
      location: request.location,
    };
    try {
      await Promise.all(
        TEXT_FIELDS.filter((field) => fieldNeedsTranslation(request[field], language)).map(
          async (field) => {
            next[field] = await translateText(request[field], language);
          },
        ),
      );
      setTranslated(next);
      setMode('translated');
      setTranslateStatus('idle');
    } catch {
      setTranslateStatus('error');
    }
  }

  async function handleReserveSubmit() {
    if (!name.trim() || !contact.trim()) {
      setReserveStatus('missing');
      return;
    }
    setReserveStatus('saving');
    try {
      const updated = await reserveRequest(request.id, name.trim(), contact.trim());
      onUpdated(updated);
      setReserveOpen(false);
      setName('');
      setContact('');
      setReserveStatus('idle');
    } catch {
      setReserveStatus('error');
    }
  }

  async function handleRelease() {
    setReleaseStatus('saving');
    try {
      const updated = await releaseRequest(request.id);
      onUpdated(updated);
      setReleaseStatus('idle');
    } catch {
      setReleaseStatus('error');
    }
  }

  const shown = mode === 'translated' && translated ? translated : request;
  const translateLabel =
    translateStatus === 'loading'
      ? t.list.translating
      : mode === 'translated'
        ? t.list.showOriginal
        : t.list.translate;

  const remainingMs = isReserved ? request.reservedUntil! - now : 0;
  const minsLeft = Math.floor(remainingMs / 60000);
  const secsLeft = Math.floor((remainingMs % 60000) / 1000);

  return (
    <li className="request-card">
      <span className={`status-badge status-${isReserved ? 'reserved' : 'open'}`}>
        {isReserved ? t.list.statusReserved : t.list.statusOpen}
      </span>
      <h3>{shown.recipient}</h3>
      <p>{shown.occasion}</p>
      <p>
        {t.list.neededByPrefix} {request.neededBy}
      </p>
      <p>
        {t.list.locationPrefix} {shown.location}
      </p>
      {request.dietary && (
        <p>
          {t.list.dietaryPrefix} {shown.dietary}
        </p>
      )}

      {needsTranslation && (
        <>
          <button
            type="button"
            onClick={handleTranslateClick}
            disabled={translateStatus === 'loading'}
          >
            {translateLabel}
          </button>
          {translateStatus === 'error' && <p className="translate-error">{t.list.translateError}</p>}
        </>
      )}

      {isReserved ? (
        <div className="reserved-box">
          <p>
            {t.list.reservedByPrefix} {request.reservedBy}
          </p>
          <p>
            {t.list.reservedContactPrefix} {request.reservedContact}
          </p>
          <p className="countdown">
            {t.list.timeLeftPrefix} {minsLeft}m {secsLeft}s
          </p>
          <button type="button" onClick={handleRelease} disabled={releaseStatus === 'saving'}>
            {releaseStatus === 'saving' ? t.list.releasing : t.list.release}
          </button>
          {releaseStatus === 'error' && <p className="reserve-error">{t.list.releaseError}</p>}
        </div>
      ) : reserveOpen ? (
        <div className="reserve-form">
          <label>
            {t.list.reserveNameLabel}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {t.list.reserveContactLabel}
            <input value={contact} onChange={(e) => setContact(e.target.value)} />
          </label>
          <div className="reserve-form-actions">
            <button type="button" onClick={handleReserveSubmit} disabled={reserveStatus === 'saving'}>
              {reserveStatus === 'saving' ? t.list.reserving : t.list.reserveConfirm}
            </button>
            <button
              type="button"
              onClick={() => {
                setReserveOpen(false);
                setReserveStatus('idle');
              }}
            >
              {t.list.reserveCancel}
            </button>
          </div>
          {reserveStatus === 'missing' && <p className="reserve-error">{t.list.reserveMissing}</p>}
          {reserveStatus === 'error' && <p className="reserve-error">{t.list.reserveError}</p>}
        </div>
      ) : (
        <button type="button" className="reserve-button" onClick={() => setReserveOpen(true)}>
          {t.list.reserve}
        </button>
      )}
    </li>
  );
}
