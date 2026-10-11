import { describe, it, expect } from 'vitest';
import { isRecoveryLink } from './recoveryLink';

describe('isRecoveryLink', () => {
  it('recognises a Supabase password-recovery link fragment', () => {
    expect(isRecoveryLink('#access_token=abc&expires_in=3600&refresh_token=x&token_type=bearer&type=recovery')).toBe(true);
    expect(isRecoveryLink('#type=recovery&access_token=abc')).toBe(true);
  });
  it('ignores other links', () => {
    expect(isRecoveryLink('')).toBe(false);
    expect(isRecoveryLink('#access_token=abc&type=signup')).toBe(false);
    expect(isRecoveryLink('#access_token=abc&type=recovery_extra')).toBe(false);
  });
});
