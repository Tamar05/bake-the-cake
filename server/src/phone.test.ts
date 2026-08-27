import { describe, it, expect } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone (server)', () => {
  it('normalizes a local Israeli mobile number to +972 E.164', () => {
    expect(normalizePhone('050-123-4567')).toBe('+972501234567');
    expect(normalizePhone('0501234567')).toBe('+972501234567');
  });

  it('normalizes a local Israeli landline to +972 E.164', () => {
    expect(normalizePhone('02-123-4567')).toBe('+97221234567');
  });

  it('accepts an already-international number and leaves it canonical', () => {
    expect(normalizePhone('+972 50-123-4567')).toBe('+972501234567');
    expect(normalizePhone('+1 415 555 0132')).toBe('+14155550132');
  });

  it('rejects blanks, text, and numbers that are not real', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('not a phone')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('050-123')).toBeNull();
  });
});
