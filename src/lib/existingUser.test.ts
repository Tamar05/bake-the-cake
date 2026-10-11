import { describe, it, expect } from 'vitest';
import { isExistingUserResponse } from './existingUser';

describe('isExistingUserResponse', () => {
  it('flags the placeholder user Supabase returns for an already-registered email', () => {
    expect(isExistingUserResponse({ identities: [] })).toBe(true);
  });
  it('does not flag a genuinely new sign-up', () => {
    expect(isExistingUserResponse({ identities: [{ provider: 'email' }] })).toBe(false);
  });
  it('does not flag when identities is missing or there is no user', () => {
    expect(isExistingUserResponse({})).toBe(false);
    expect(isExistingUserResponse({ identities: null })).toBe(false);
    expect(isExistingUserResponse(null)).toBe(false);
    expect(isExistingUserResponse(undefined)).toBe(false);
  });
});
