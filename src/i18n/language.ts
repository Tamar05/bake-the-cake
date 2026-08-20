import type { Dictionary } from './types';
import { en } from './en';
import { he } from './he';

// The two languages the app supports.
export type Language = 'en' | 'he';

// Both dictionaries in one place, looked up by language code.
export const dictionaries: Record<Language, Dictionary> = { en, he };

// Where the chosen language is stored in the browser's small-settings store.
const STORAGE_KEY = 'btc-language';

// Reads the saved language, defaulting to English if nothing valid is stored.
export function loadLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'he' || saved === 'en' ? saved : 'en';
}

// Saves the chosen language so it survives a refresh.
export function saveLanguage(language: Language): void {
  localStorage.setItem(STORAGE_KEY, language);
}
