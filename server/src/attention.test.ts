import { describe, it, expect } from 'vitest';
import { attentionReason, UNCLAIMED_MS } from './attention';
import type { CakeRequest } from './types';

const now = Date.parse('2026-08-26T12:00:00.000Z');

const base: CakeRequest = {
  id: 'r1',
  recipient: 'Maya',
  occasion: 'birthday',
  neededBy: '2026-09-10', // comfortably in the future
  dietary: '',
  location: 'Haifa',
  createdAt: now, // just created
  ownerId: 'user-req',
  status: 'open',
  reservedBy: null,
  reservedContact: null,
  reservedByUserId: null,
  reservedUntil: null,
  reservedAt: null,
  committedAt: null,
  deliveredAt: null,
  receivedAt: null,
  hasPhoto: false,
};

describe('attentionReason', () => {
  it('a fresh open request needs no attention', () => {
    expect(attentionReason(base, now)).toBeNull();
  });

  it('flags an open request with no baker for over a week as unclaimed', () => {
    const old = { ...base, createdAt: now - UNCLAIMED_MS - 1 };
    expect(attentionReason(old, now)).toBe('unclaimed');
  });

  it('does not flag a not-quite-week-old open request', () => {
    const recent = { ...base, createdAt: now - UNCLAIMED_MS + 1000 };
    expect(attentionReason(recent, now)).toBeNull();
  });

  it('flags a request past its needed-by date and not delivered as overdue', () => {
    const overdue = { ...base, neededBy: '2026-08-20', status: 'reserved' as const };
    expect(attentionReason(overdue, now)).toBe('overdue');
  });

  it('overdue wins over unclaimed when both apply', () => {
    const both = { ...base, neededBy: '2026-08-20', createdAt: now - UNCLAIMED_MS - 1 };
    expect(attentionReason(both, now)).toBe('overdue');
  });

  it('a delivered or received cake is never flagged, even if past its date', () => {
    expect(attentionReason({ ...base, neededBy: '2026-08-20', status: 'delivered' }, now)).toBeNull();
    expect(attentionReason({ ...base, neededBy: '2026-08-20', status: 'received' }, now)).toBeNull();
  });
});
