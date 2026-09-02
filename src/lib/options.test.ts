import { describe, it, expect } from 'vitest';
import { knownOnly, AREAS } from './options';

describe('knownOnly', () => {
  it('drops values no longer in the current option list', () => {
    // The real bug: a baker saved these areas before the list changed to Beit
    // Shemesh neighborhoods. "Tel Aviv"/"Jerusalem" are gone, so loading them
    // back must not re-introduce them (the server would reject the whole save).
    expect(knownOnly(['Tel Aviv', 'Rama A', 'Jerusalem'], AREAS)).toEqual(['Rama A']);
  });

  it('keeps all values when every one is still valid', () => {
    expect(knownOnly(['Rama A', 'Mishkafayim'], AREAS)).toEqual(['Rama A', 'Mishkafayim']);
  });

  it('preserves the input order', () => {
    expect(knownOnly(['Mishkafayim', 'Rama A'], AREAS)).toEqual(['Mishkafayim', 'Rama A']);
  });

  it('returns an empty list when nothing is valid', () => {
    expect(knownOnly(['Tel Aviv', 'Jerusalem'], AREAS)).toEqual([]);
  });

  it('returns an empty list for empty input', () => {
    expect(knownOnly([], AREAS)).toEqual([]);
  });
});
