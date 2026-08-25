import { describe, it, expect } from 'vitest';
import { detectTextLanguage, fieldNeedsTranslation } from './detectLanguage';

describe('detectTextLanguage', () => {
  it('calls text with Hebrew letters Hebrew', () => {
    expect(detectTextLanguage('יום הולדת')).toBe('he');
  });

  it('calls Latin-only text English', () => {
    expect(detectTextLanguage('8th birthday')).toBe('en');
  });

  it('treats a mixed field as Hebrew (any Hebrew letter wins)', () => {
    expect(detectTextLanguage('ben יום הולדת')).toBe('he');
  });

  it('calls letterless text (empty, dates, numbers) neutral', () => {
    expect(detectTextLanguage('')).toBe('neutral');
    expect(detectTextLanguage('2026-08-27')).toBe('neutral');
    expect(detectTextLanguage('8')).toBe('neutral');
  });
});

describe('fieldNeedsTranslation', () => {
  it('is true when the field is in the other language', () => {
    expect(fieldNeedsTranslation('יום הולדת', 'en')).toBe(true);
    expect(fieldNeedsTranslation('birthday', 'he')).toBe(true);
  });

  it('is false when the field already matches the selected language', () => {
    expect(fieldNeedsTranslation('birthday', 'en')).toBe(false);
    expect(fieldNeedsTranslation('יום הולדת', 'he')).toBe(false);
  });

  it('is false for neutral fields regardless of language', () => {
    expect(fieldNeedsTranslation('2026-08-27', 'en')).toBe(false);
    expect(fieldNeedsTranslation('', 'he')).toBe(false);
  });
});
