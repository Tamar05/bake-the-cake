import { describe, it, expect } from 'vitest';
import { holdRemaining } from './holdCountdown';

describe('holdRemaining', () => {
  it('splits the remaining time into minutes and seconds', () => {
    expect(holdRemaining(1_000_000 + 61_000, 1_000_000)).toEqual({ expired: false, minutes: 1, seconds: 1 });
    expect(holdRemaining(1_000_000 + 3_600_000, 1_000_000)).toEqual({ expired: false, minutes: 60, seconds: 0 });
  });
  it('is expired at exactly zero and after', () => {
    expect(holdRemaining(5_000, 5_000)).toEqual({ expired: true, minutes: 0, seconds: 0 });
    expect(holdRemaining(5_000, 9_000)).toEqual({ expired: true, minutes: 0, seconds: 0 });
  });
  it('treats a missing deadline as expired (never a negative or NaN countdown)', () => {
    expect(holdRemaining(null, 1)).toEqual({ expired: true, minutes: 0, seconds: 0 });
  });
});
