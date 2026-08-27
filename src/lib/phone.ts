import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Israel is the default country: a bare local number like "050-123-4567" is read
// as Israeli and normalized to +972…, while a number that already carries its own
// country code (e.g. "+1 415 555 0132") keeps that country. Spaces, dashes and
// parentheses in the input don't matter.
//
// Returns the canonical E.164 string (e.g. "+972501234567") when the input is a
// real, valid phone number, or null when it isn't — so callers can both validate
// (null → reject) and store the normalized form in one step.
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), 'IL');
  return parsed && parsed.isValid() ? parsed.number : null;
}

// True when the input is a valid phone number under the same rules as above.
export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}
