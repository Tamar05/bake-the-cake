import { describe, it, expect } from 'vitest';
import {
  statusGroup,
  countByTab,
  filterByTab,
  matchesSearch,
  sortByNeededBy,
  dueFlag,
  DUE_SOON_MS,
} from './myRequests';
import type { CakeRequest } from '../types';

function makeRequest(overrides: Partial<CakeRequest> = {}): CakeRequest {
  return {
    id: 'r1',
    recipient: 'Maya',
    occasion: '8th birthday, dinosaurs',
    neededBy: '2026-09-01',
    dietary: '',
    location: 'Rama A',
    kashrut: 'Rabbanut',
    aboutRecipient: '',
    contactPhone: '050-1234567',
    createdAt: 0,
    ownerId: 'owner-1',
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
    sharedByOwner: false,
    sharedByBaker: false,
    galleryCaption: '',
    ...overrides,
  };
}

describe('statusGroup', () => {
  it('keeps open as its own group', () => {
    expect(statusGroup('open')).toBe('open');
  });

  it('groups reserved, committed, and delivered as in progress', () => {
    expect(statusGroup('reserved')).toBe('inProgress');
    expect(statusGroup('committed')).toBe('inProgress');
    expect(statusGroup('delivered')).toBe('inProgress');
  });

  it('treats received as done', () => {
    expect(statusGroup('received')).toBe('done');
  });
});

describe('countByTab', () => {
  it('tallies every tab including all', () => {
    const requests = [
      makeRequest({ status: 'open' }),
      makeRequest({ status: 'reserved' }),
      makeRequest({ status: 'committed' }),
      makeRequest({ status: 'delivered' }),
      makeRequest({ status: 'received' }),
    ];
    expect(countByTab(requests)).toEqual({ all: 5, open: 1, inProgress: 3, done: 1 });
  });

  it('returns all zeros for an empty list', () => {
    expect(countByTab([])).toEqual({ all: 0, open: 0, inProgress: 0, done: 0 });
  });
});

describe('filterByTab', () => {
  const requests = [makeRequest({ id: 'a', status: 'open' }), makeRequest({ id: 'b', status: 'received' })];

  it('returns everything for the all tab', () => {
    expect(filterByTab(requests, 'all')).toEqual(requests);
  });

  it('filters down to the matching status group', () => {
    expect(filterByTab(requests, 'done').map((r) => r.id)).toEqual(['b']);
  });
});

describe('matchesSearch', () => {
  const request = makeRequest({ recipient: 'Maya Cohen', occasion: '8th birthday, dinosaurs' });

  it('matches everything when the query is blank', () => {
    expect(matchesSearch(request, '')).toBe(true);
    expect(matchesSearch(request, '   ')).toBe(true);
  });

  it('matches case-insensitively on recipient name', () => {
    expect(matchesSearch(request, 'maya')).toBe(true);
  });

  it('matches case-insensitively on occasion', () => {
    expect(matchesSearch(request, 'BIRTHDAY')).toBe(true);
  });

  it('does not match unrelated text', () => {
    expect(matchesSearch(request, 'wedding')).toBe(false);
  });
});

describe('sortByNeededBy', () => {
  it('orders soonest needed-by date first', () => {
    const requests = [
      makeRequest({ id: 'c', neededBy: '2026-09-10' }),
      makeRequest({ id: 'a', neededBy: '2026-09-01' }),
      makeRequest({ id: 'b', neededBy: '2026-09-05' }),
    ];
    expect(sortByNeededBy(requests).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the original array', () => {
    const requests = [makeRequest({ id: 'b', neededBy: '2026-09-05' }), makeRequest({ id: 'a', neededBy: '2026-09-01' })];
    sortByNeededBy(requests);
    expect(requests.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('dueFlag', () => {
  const now = new Date('2026-09-09T12:00:00Z').getTime();

  it('flags a past needed-by date as overdue', () => {
    expect(dueFlag(makeRequest({ neededBy: '2026-09-08', status: 'open' }), now)).toBe('overdue');
  });

  it('flags a date within the soon window as soon', () => {
    expect(dueFlag(makeRequest({ neededBy: '2026-09-10', status: 'reserved' }), now)).toBe('soon');
  });

  it('leaves a far-off date unflagged', () => {
    expect(dueFlag(makeRequest({ neededBy: '2026-09-30', status: 'open' }), now)).toBeNull();
  });

  it('never flags a delivered request', () => {
    expect(dueFlag(makeRequest({ neededBy: '2026-09-01', status: 'delivered' }), now)).toBeNull();
  });

  it('never flags a received request', () => {
    expect(dueFlag(makeRequest({ neededBy: '2026-09-01', status: 'received' }), now)).toBeNull();
  });

  it('the soon window is two days', () => {
    expect(DUE_SOON_MS).toBe(2 * 24 * 60 * 60 * 1000);
  });
});
