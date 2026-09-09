import { isValidPhone } from './phone';

// The Supabase project's password policy: at least 8 characters, and at least
// one lowercase letter, one uppercase letter, and one digit. Checked on the
// client so the user sees a friendly hint instead of the raw server error.
// Shared by AuthPanel (sign-up) and JoinPage (sign-up + join in one flow).
export function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The sign-up contact may be a phone number OR an email. Empty is allowed
// (the field is optional); anything present must be a valid one or the other.
export function isValidContact(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === '' || isValidPhone(trimmed) || EMAIL_RE.test(trimmed);
}
