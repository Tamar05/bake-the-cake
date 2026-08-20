import type { CakeRequest, RequestDraft } from '../types';

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

// A short id, unique enough for the in-memory list; works in the browser and in tests.
function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Turns a filled-in form draft into a full cake-request record.
export function createRequest(draft: RequestDraft): CakeRequest {
  return {
    id: makeId(),
    recipient: draft.recipient.trim(),
    occasion: draft.occasion.trim(),
    neededBy: draft.neededBy,
    dietary: draft.dietary.trim(),
    location: draft.location.trim(),
    createdAt: Date.now(),
  };
}
