import { useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import { translateText } from '../lib/translationApi';

type Props = {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
};

type Mode = 'original' | 'translated';
type Status = 'idle' | 'loading' | 'error';

// The four typed-in text fields we translate (the date is never translated).
type Translated = {
  recipient: string;
  occasion: string;
  dietary: string;
  location: string;
};

export default function RequestCard({ t, language, request }: Props) {
  const [mode, setMode] = useState<Mode>('original');
  const [status, setStatus] = useState<Status>('idle');
  const [translated, setTranslated] = useState<Translated | null>(null);

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
    // First time → translate each non-empty field into the current language.
    setStatus('loading');
    try {
      const [recipient, occasion, dietary, location] = await Promise.all([
        translateText(request.recipient, language),
        translateText(request.occasion, language),
        request.dietary ? translateText(request.dietary, language) : Promise.resolve(''),
        translateText(request.location, language),
      ]);
      setTranslated({ recipient, occasion, dietary, location });
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
      <button type="button" onClick={handleTranslateClick} disabled={status === 'loading'}>
        {buttonLabel}
      </button>
      {status === 'error' && <p className="translate-error">{t.list.translateError}</p>}
    </li>
  );
}
