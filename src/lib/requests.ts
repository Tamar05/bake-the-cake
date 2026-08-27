import type { RequestDraft } from '../types';

// dietary and aboutRecipient are intentionally NOT in this list — both optional.
const REQUIRED_FIELDS: Array<keyof RequestDraft> = [
  'recipient',
  'occasion',
  'neededBy',
  'location',
  'kashrut',
  'contactPhone',
];

// Returns the required fields that are still blank (ignoring surrounding spaces).
export function findMissingFields(draft: RequestDraft): Array<keyof RequestDraft> {
  return REQUIRED_FIELDS.filter((field) => draft[field].trim() === '');
}
