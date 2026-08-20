import type { Language } from '../i18n/language';

// The server's address, set per environment in the frontend .env file.
function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// Asks the server to translate one piece of text into the target language.
export async function translateText(text: string, to: Language): Promise<string> {
  const res = await fetch(`${apiBase()}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, to }),
  });
  if (!res.ok) throw new Error(`Could not translate (HTTP ${res.status})`);
  const data = (await res.json()) as { translated: string };
  return data.translated;
}
