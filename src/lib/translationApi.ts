import type { Language } from '../i18n/language';

// Translation runs in the visitor's own browser, not on our server. MyMemory
// limits its free tier per IP address, and our Render server shares one address
// with many other apps (it was answering HTTP 429). From the browser each
// visitor gets their own quota. The email is not a secret; MyMemory just uses it
// to raise the daily limit.
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';
const CONTACT_EMAIL = 'tamatcakeproject@gmail.com';
const TEXT_MAX = 500; // MyMemory rejects queries over 500 bytes-ish; keep well within it

type MyMemoryResponse = {
  responseData?: { translatedText?: string };
  responseStatus?: number | string;
};

// Asks MyMemory to translate one piece of text into the target language.
export async function translateText(text: string, to: Language): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nothing to translate');
  if (trimmed.length > TEXT_MAX) throw new Error('Text is too long to translate');
  const from = to === 'he' ? 'en' : 'he';
  const url =
    `${MYMEMORY_URL}?q=${encodeURIComponent(trimmed)}&langpair=${from}|${to}` +
    `&de=${encodeURIComponent(CONTACT_EMAIL)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not translate (HTTP ${res.status})`);
  const data = (await res.json()) as MyMemoryResponse;
  // MyMemory can answer HTTP 200 with an error status in the body (e.g. quota used up).
  if (Number(data.responseStatus ?? 200) !== 200) {
    throw new Error(`Could not translate (service status ${data.responseStatus})`);
  }
  const translated = data.responseData?.translatedText;
  if (!translated) throw new Error('Could not translate (no text returned)');
  return translated;
}
