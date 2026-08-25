import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import { translateText } from '../lib/translationApi';
import { fieldNeedsTranslation } from '../lib/detectLanguage';

type Props = {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
};

type Mode = 'original' | 'translated';
type Status = 'idle' | 'loading' | 'error';

// The four typed-in text fields we may translate (the date is never translated).
type Translated = {
  recipient: string;
  occasion: string;
  dietary: string;
  location: string;
};
const TEXT_FIELDS = ['recipient', 'occasion', 'dietary', 'location'] as const;

export default function RequestCard({ t, language, request }: Props) {
  const [mode, setMode] = useState<Mode>('original');
  const [status, setStatus] = useState<Status>('idle');
  const [translated, setTranslated] = useState<Translated | null>(null);

  // Switching the language selector makes any earlier translation stale (its
  // target language changed), so start this card fresh in its original text.
  useEffect(() => {
    setMode('original');
    setStatus('idle');
    setTranslated(null);
  }, [language]);

  // Show the Translate button only when at least one field is in a language
  // other than the one being read — otherwise the card is already readable.
  const needsTranslation = TEXT_FIELDS.some((field) =>
    fieldNeedsTranslation(request[field], language),
  );

  async function handleTranslateClick() {
    // Already showing the translation → flip back to the original.
    if (mode === 'translated') {
      setMode('original');
      return;
    }
    // We fetched it before → reuse the cache, no new network call.
    if (translated) {
      setMode('translated');
      return;
    }
    // First time → translate only the fields that aren't already in the
    // selected language; leave the rest exactly as they were typed.
    setStatus('loading');
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
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  const shown = mode === 'translated' && translated ? translated : request;
  const buttonLabel =
    status === 'loading'
      ? t.list.translating
      : mode === 'translated'
        ? t.list.showOriginal
        : t.list.translate;

  return (
    <li className="request-card">
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
          <button type="button" onClick={handleTranslateClick} disabled={status === 'loading'}>
            {buttonLabel}
          </button>
          {status === 'error' && <p className="translate-error">{t.list.translateError}</p>}
        </>
      )}
    </li>
  );
}
