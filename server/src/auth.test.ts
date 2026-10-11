import { describe, it, expect } from 'vitest';
import { isActive } from './auth';

describe('isActive', () => {
  it('is true for a baker who has never been suspended, verified or not', () => {
    expect(isActive(null)).toBe(true);
  });
  it('is false once an admin has suspended them', () => {
    expect(isActive('2026-10-11T10:00:00.000Z')).toBe(false);
  });
});
