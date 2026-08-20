import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadLanguage, saveLanguage } from './language';

// A tiny in-memory stand-in for the browser's localStorage, so these
// pure-logic tests can run in Node (which has no localStorage).
function makeLocalStorageStub() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => (key in store ? store[key] : null),
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    clear: (): void => {
      store = {};
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorageStub());
});

describe('loadLanguage', () => {
  it('defaults to English when nothing is saved', () => {
    expect(loadLanguage()).toBe('en');
  });

  it('returns the saved language after saveLanguage', () => {
    saveLanguage('he');
    expect(loadLanguage()).toBe('he');
  });

  it('falls back to English when the saved value is not a known language', () => {
    localStorage.setItem('btc-language', 'fr');
    expect(loadLanguage()).toBe('en');
  });
});
