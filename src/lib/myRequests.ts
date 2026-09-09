import type { CakeRequest } from '../types';

// Groups the five server statuses into a simpler three-way "how far along"
// view for a coordinator managing many requests at once: still needs a baker,
// being worked on, or fully done. Mirrors the grouping used on the stats
// dashboard.
export type StatusGroup = 'open' | 'inProgress' | 'done';

export function statusGroup(status: CakeRequest['status']): StatusGroup {
  if (status === 'open') return 'open';
  if (status === 'received') return 'done';
  return 'inProgress'; // reserved, committed, delivered
}

export type StatusTab = 'all' | StatusGroup;

// How many requests fall in each status tab, "all" included — feeds the tally
// line above the tabs (e.g. "12 requests · 5 open · 4 in progress · 3 delivered").
export function countByTab(requests: CakeRequest[]): Record<StatusTab, number> {
  const counts: Record<StatusTab, number> = { all: requests.length, open: 0, inProgress: 0, done: 0 };
  for (const request of requests) counts[statusGroup(request.status)]++;
  return counts;
}

export function filterByTab(requests: CakeRequest[], tab: StatusTab): CakeRequest[] {
  return tab === 'all' ? requests : requests.filter((request) => statusGroup(request.status) === tab);
}

// Case-insensitive match against recipient name or occasion — the two fields a
// coordinator scanning a long list is likeliest to search by. An empty query
// matches everything.
export function matchesSearch(request: CakeRequest, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return request.recipient.toLowerCase().includes(q) || request.occasion.toLowerCase().includes(q);
}

// Soonest needed-by date first. Array.prototype.sort is stable, so requests
// due on the same date keep their original (creation) order.
export function sortByNeededBy(requests: CakeRequest[]): CakeRequest[] {
  return [...requests].sort((a, b) => a.neededBy.localeCompare(b.neededBy));
}

// How far ahead of its needed-by date a request starts flagging as "due soon".
// No exact bar was agreed with the user; two days gives a coordinator a
// heads-up while there's still time to chase a baker.
export const DUE_SOON_MS = 2 * 24 * 60 * 60 * 1000;

export type DueFlag = 'overdue' | 'soon' | null;

// Same "not done yet" + yyyy-mm-dd string comparison server/src/attention.ts
// uses for its 'overdue' reason, plus an earlier 'soon' warning for anything
// landing within DUE_SOON_MS. Delivered/received requests never flag — they're
// no longer waiting on anyone.
export function dueFlag(request: CakeRequest, now: number): DueFlag {
  const done = request.status === 'delivered' || request.status === 'received';
  if (done) return null;
  const today = new Date(now).toISOString().slice(0, 10);
  if (request.neededBy < today) return 'overdue';
  const soonBy = new Date(now + DUE_SOON_MS).toISOString().slice(0, 10);
  if (request.neededBy <= soonBy) return 'soon';
  return null;
}
