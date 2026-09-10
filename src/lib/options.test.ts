import { describe, it, expect } from 'vitest';
import { knownOnly, DIETARY_OPTIONS } from './options';

describe('knownOnly', () => {
  it('drops values no longer in the current option list', () => {
    // The real bug: a baker saved these dietary needs before the list changed.
    // Removed values are gone, so loading them back must not re-introduce them
    // (the server would reject the whole save).
    expect(knownOnly(['keto', 'nut-free', 'paleo'], DIETARY_OPTIONS)).toEqual(['nut-free']);
  });

  it('keeps all values when every one is still valid', () => {
    expect(knownOnly(['nut-free', 'vegan'], DIETARY_OPTIONS)).toEqual(['nut-free', 'vegan']);
  });

  it('preserves the input order', () => {
    expect(knownOnly(['vegan', 'nut-free'], DIETARY_OPTIONS)).toEqual(['vegan', 'nut-free']);
  });

  it('returns an empty list when nothing is valid', () => {
    expect(knownOnly(['keto', 'paleo'], DIETARY_OPTIONS)).toEqual([]);
  });

  it('returns an empty list for empty input', () => {
    expect(knownOnly([], DIETARY_OPTIONS)).toEqual([]);
  });
});
