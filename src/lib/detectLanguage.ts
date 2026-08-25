import type { Language } from '../i18n/language';

// The result of judging one piece of text. 'neutral' means "no letters at all"
// (empty, a date, or just numbers/punctuation) — text that reads fine in either
// language and so never needs translating.
export type TextLanguage = Language | 'neutral';

// Hebrew letters live in this Unicode block; Latin letters are A–Z / a–z.
const HEBREW_LETTER = /[֐-׿]/;
const LATIN_LETTER = /[A-Za-z]/;

// Judges a single field. Hebrew wins if any Hebrew letter is present (so a
// mixed field counts as Hebrew); otherwise Latin letters mean English; text
// with no letters at all is neutral.
export function detectTextLanguage(text: string): TextLanguage {
  if (HEBREW_LETTER.test(text)) return 'he';
  if (LATIN_LETTER.test(text)) return 'en';
  return 'neutral';
}

// True when this field is written in a real language other than the one the
// reader has selected — i.e. it would need translating to be readable.
export function fieldNeedsTranslation(text: string, selected: Language): boolean {
  const detected = detectTextLanguage(text);
  return detected !== 'neutral' && detected !== selected;
}
