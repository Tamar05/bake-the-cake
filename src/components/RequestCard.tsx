import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import { translateText } from '../lib/translationApi';
import { reserveRequest, releaseRequest, commitRequest, deleteRequest } from '../lib/requestsApi';
import { fieldNeedsTranslation } from '../lib/detectLanguage';
import { useAuth } from '../auth/AuthProvider';

type Props = {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
  onUpdated: (updated: CakeRequest) => void;
  onDeleted: (id: string) => void;
};

type Mode = 'original' | 'translated';
type TranslateStatus = 'idle' | 'loading' | 'error';
type ActionStatus = 'idle' | 'saving' | 'error';

// The four typed-in text fields we may translate (the date is never translated).
type Translated = {
  recipient: string;
  occasion: string;
  dietary: string;
  location: string;
};
const TEXT_FIELDS = ['recipient', 'occasion', 'dietary', 'location'] as const;

export default function RequestCard({ t, language, request, onUpdated, onDeleted }: Props) {
  const { profile, session } = useAuth();
  const token = session?.access_token;

  const [mode, setMode] = useState<Mode>('original');
  const [translateStatus, setTranslateStatus] = useState<TranslateStatus>('idle');
  const [translated, setTranslated] = useState<Translated | null>(null);

  const [reserveStatus, setReserveStatus] = useState<ActionStatus>('idle');
  const [releaseStatus, setReleaseStatus] = useState<ActionStatus>('idle');
  const [commitStatus, setCommitStatus] = useState<ActionStatus>('idle');
  const [deleteStatus, setDeleteStatus] = useState<ActionStatus>('idle');

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

  // A fresh reservation is "active" only while its client-side countdown still
  // has time on it; once past, the card behaves as open again (the server agrees
  // on the next load). A committed request has no countdown — it stays claimed.
  const committed = request.status === 'committed';
  const reservedActive =
    request.status === 'reserved' && request.reservedUntil != null && request.reservedUntil > now;
  const claimed = committed || reservedActive;

  // Who can do what: only bakers/admins reserve; only the baker holding it (or an
  // admin) may commit or release. The server enforces the same rules — this just
  // decides which buttons to show.
  const isHolder =
    profile != null && (request.reservedByUserId === profile.id || profile.role === 'admin');
  const canReserve = profile?.role === 'baker' || profile?.role === 'admin';
  const canRelease = isHolder;
  const canCommit = reservedActive && isHolder;

  // Who can remove this request: the requester who owns it (cancel their own) or
  // an admin (remove anything). Legacy rows have no owner, so only an admin. The
  // owner sees "Cancel request"; an admin acting on someone else's sees "Delete".
  const isOwner = profile != null && request.ownerId != null && request.ownerId === profile.id;
  const canDelete = isOwner || profile?.role === 'admin';

  // Switching the language selector makes any earlier translation stale.
  useEffect(() => {
    setMode('original');
    setTranslateStatus('idle');
    setTranslated(null);
  }, [language]);

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

  async function handleReserve() {
    if (!token) return;
    setReserveStatus('saving');
    try {
      onUpdated(await reserveRequest(request.id, token));
      setReserveStatus('idle');
    } catch {
      setReserveStatus('error');
    }
  }

  async function handleRelease() {
    if (!token) return;
    setReleaseStatus('saving');
    try {
      onUpdated(await releaseRequest(request.id, token));
      setReleaseStatus('idle');
    } catch {
      setReleaseStatus('error');
    }
  }

  async function handleCommit() {
    if (!token) return;
    setCommitStatus('saving');
    try {
      onUpdated(await commitRequest(request.id, token));
      setCommitStatus('idle');
    } catch {
      setCommitStatus('error');
    }
  }

  async function handleDelete() {
    if (!token) return;
    // A deletion can't be undone, so ask before doing it.
    const confirmText = isOwner ? t.list.confirmCancel : t.list.confirmDelete;
    if (!window.confirm(confirmText)) return;
    setDeleteStatus('saving');
    try {
      await deleteRequest(request.id, token);
      onDeleted(request.id); // parent drops it from the list
    } catch {
      setDeleteStatus('error');
    }
  }

  const shown = mode === 'translated' && translated ? translated : request;
  const translateLabel =
    translateStatus === 'loading'
      ? t.list.translating
      : mode === 'translated'
        ? t.list.showOriginal
        : t.list.translate;

  const remainingMs = reservedActive ? request.reservedUntil! - now : 0;
  const minsLeft = Math.floor(remainingMs / 60000);
  const secsLeft = Math.floor((remainingMs % 60000) / 1000);

  const badgeStatus = committed ? 'committed' : reservedActive ? 'reserved' : 'open';
  const badgeLabel = committed
    ? t.list.statusBaking
    : reservedActive
      ? t.list.statusReserved
      : t.list.statusOpen;

  return (
    <li className="request-card">
      <span className={`status-badge status-${badgeStatus}`}>{badgeLabel}</span>
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

      {claimed ? (
        <div className={`reserved-box${committed ? ' committed-box' : ''}`}>
          {request.reservedBy && (
            <p>
              {t.list.reservedByPrefix} {request.reservedBy}
            </p>
          )}
          {request.reservedContact && (
            <p>
              {t.list.reservedContactPrefix} {request.reservedContact}
            </p>
          )}
          {reservedActive && (
            <p className="countdown">
              {t.list.timeLeftPrefix} {minsLeft}m {secsLeft}s
            </p>
          )}
          {committed && <p className="baking-note">{t.list.bakingNote}</p>}
          {canCommit && (
            <>
              <button
                type="button"
                className="reserve-button"
                onClick={handleCommit}
                disabled={commitStatus === 'saving'}
              >
                {commitStatus === 'saving' ? t.list.committing : t.list.commit}
              </button>
              {commitStatus === 'error' && <p className="reserve-error">{t.list.commitError}</p>}
            </>
          )}
          {canRelease && (
            <>
              <button type="button" onClick={handleRelease} disabled={releaseStatus === 'saving'}>
                {releaseStatus === 'saving' ? t.list.releasing : t.list.release}
              </button>
              {releaseStatus === 'error' && <p className="reserve-error">{t.list.releaseError}</p>}
            </>
          )}
        </div>
      ) : (
        canReserve && (
          <>
            <button
              type="button"
              className="reserve-button"
              onClick={handleReserve}
              disabled={reserveStatus === 'saving'}
            >
              {reserveStatus === 'saving' ? t.list.reserving : t.list.reserve}
            </button>
            {reserveStatus === 'error' && <p className="reserve-error">{t.list.reserveError}</p>}
          </>
        )
      )}

      {canDelete && (
        <div className="card-actions">
          <button
            type="button"
            className="delete-button"
            onClick={handleDelete}
            disabled={deleteStatus === 'saving'}
          >
            {deleteStatus === 'saving'
              ? t.list.deleting
              : isOwner
                ? t.list.cancelRequest
                : t.list.deleteRequest}
          </button>
          {deleteStatus === 'error' && <p className="reserve-error">{t.list.deleteError}</p>}
        </div>
      )}
    </li>
  );
}
