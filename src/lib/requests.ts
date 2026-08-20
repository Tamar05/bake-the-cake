import type { RequestDraft } from '../types';

// dietary is intentionally NOT in this list — it is optional.
const REQUIRED_FIELDS: Array<keyof RequestDraft> = [
  'recipient',
  'occasion',
  'neededBy',
  'location',
];

// Returns the required fields that are still blank (ignoring surrounding spaces).
export function findMissingFields(draft: RequestDraft): Array<keyof RequestDraft> {
  return REQUIRED_FIELDS.filter((field) => draft[field].trim() === '');
}
