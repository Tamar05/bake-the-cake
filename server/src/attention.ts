import type { CakeRequest } from './types';
import { OTHER_PREFIX } from './towns';

// How long an open request may sit with no baker before it counts as stuck.
export const UNCLAIMED_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type AttentionReason = 'overdue' | 'unclaimed' | 'unrecognized-town';

// Why a request needs an admin's attention, or null if it's fine. "Overdue"
// (past its needed-by date and not yet delivered) is the most urgent, then
// "unclaimed" (open with no baker for a week), then "unrecognized-town" (the
// requester's town wasn't in the built-in list — Phase 5's "Other: " escape
// hatch — informational, so it's the lowest priority of the three). Gated by
// `!done` like the others, so it clears once the cake is delivered/received
// rather than sitting on the admin's list forever.
export function attentionReason(request: CakeRequest, now: number): AttentionReason | null {
  const done = request.status === 'delivered' || request.status === 'received';
  const today = new Date(now).toISOString().slice(0, 10); // yyyy-mm-dd, sorts chronologically
  if (!done && request.neededBy < today) return 'overdue';
  if (request.status === 'open' && now - request.createdAt > UNCLAIMED_MS) return 'unclaimed';
  if (!done && request.location.startsWith(OTHER_PREFIX)) return 'unrecognized-town';
  return null;
}
