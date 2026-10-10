// What the translate endpoint needs from a translator. The real one calls the
// free MyMemory API; tests inject a fake with the same shape.
export type Translator = {
  translate(text: string, from: string, to: string): Promise<string>;
};

type MyMemoryResponse = {
  responseData?: { translatedText?: string };
};

// MyMemory gives a much larger free daily quota when requests carry a contact
// email (the `de` parameter). Not a secret; override with MYMEMORY_EMAIL.
const DEFAULT_CONTACT_EMAIL = 'tamatcakeproject@gmail.com';

// A translator backed by the free MyMemory API (no key required).
export function createMyMemoryTranslator(
  contactEmail: string = process.env.MYMEMORY_EMAIL || DEFAULT_CONTACT_EMAIL,
): Translator {
  return {
    async translate(text: string, from: string, to: string): Promise<string> {
      const url =
        'https://api.mymemory.translated.net/get' +
        `?q=${encodeURIComponent(text)}&langpair=${from}|${to}` +
        `&de=${encodeURIComponent(contactEmail)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Translation service error (HTTP ${res.status})`);
      const data = (await res.json()) as MyMemoryResponse;
      const translated = data.responseData?.translatedText;
      if (!translated) throw new Error('Translation service returned no text');
      return translated;
    },
  };
}
