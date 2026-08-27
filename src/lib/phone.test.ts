import { describe, it, expect } from 'vitest';
import { normalizePhone, isValidPhone } from './phone';

describe('normalizePhone', () => {
  it('normalizes a local Israeli mobile number to +972 E.164', () => {
    expect(normalizePhone('050-123-4567')).toBe('+972501234567');
    expect(normalizePhone('0501234567')).toBe('+972501234567');
    expect(normalizePhone('052 123 4567')).toBe('+972521234567');
  });

  it('normalizes a local Israeli landline to +972 E.164', () => {
    expect(normalizePhone('02-123-4567')).toBe('+97221234567');
    expect(normalizePhone('09 123 4567')).toBe('+97291234567');
  });

  it('accepts an already-international Israeli number', () => {
    expect(normalizePhone('+972 50-123-4567')).toBe('+972501234567');
    expect(normalizePhone('+972501234567')).toBe('+972501234567');
  });

  it('accepts an international number from another country', () => {
    expect(normalizePhone('+1 415 555 0132')).toBe('+14155550132');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('rejects blanks, text, and numbers that are not real', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone('not a phone')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('050-123')).toBeNull(); // too short for an Israeli mobile
    expect(normalizePhone('+972 1 2')).toBeNull();
  });

  it('isValidPhone agrees with normalizePhone', () => {
    expect(isValidPhone('050-123-4567')).toBe(true);
    expect(isValidPhone('nope')).toBe(false);
  });
});
