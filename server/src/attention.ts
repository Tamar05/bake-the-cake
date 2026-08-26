import type { CakeRequest } from './types';

// How long an open request may sit with no baker before it counts as stuck.
export const UNCLAIMED_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type AttentionReason = 'overdue' | 'unclaimed';

// Why a request needs an admin's attention, or null if it's fine. "Overdue"
// (past its needed-by date and not yet delivered) is the more urgent flag, so it
// wins over "unclaimed" (open with no baker for a week).
export function attentionReason(request: CakeRequest, now: number): AttentionReason | null {
  const done = request.status === 'delivered' || request.status === 'received';
  const today = new Date(now).toISOString().slice(0, 10); // yyyy-mm-dd, sorts chronologically
  if (!done && request.neededBy < today) return 'overdue';
  if (request.status === 'open' && now - request.createdAt > UNCLAIMED_MS) return 'unclaimed';
  return null;
}
