import { describe, it, expect } from 'vitest';
import { matchesCapabilities, type BakerCapabilities } from './matching';
import type { CakeRequest } from './types';

const request: CakeRequest = {
  id: 'r1',
  recipient: 'Maya',
  occasion: 'birthday',
  neededBy: '2026-09-10',
  dietary: 'nut-free, vegan',
  location: 'Haifa',
  kashrut: 'Badatz Eda Haredit',
  aboutRecipient: '',
  contactPhone: '',
  createdAt: 0,
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
  sharedByOwner: false,
  sharedByBaker: false,
  galleryCaption: '',
};

// A baker who can make exactly this request.
const fullMatch: BakerCapabilities = {
  areas: ['Haifa', 'Tel Aviv'],
  dietary: ['nut-free', 'vegan', 'dairy-free'],
  kashrut: ['Badatz Eda Haredit', 'Rabbanut'],
};

describe('matchesCapabilities', () => {
  it('matches when area, kashrut and every dietary need are covered', () => {
    expect(matchesCapabilities(request, fullMatch)).toBe(true);
  });

  it('does not match when the area is not one the baker serves', () => {
    expect(matchesCapabilities(request, { ...fullMatch, areas: ['Tel Aviv'] })).toBe(false);
  });

  it('does not match when none of the acceptable kashrut levels are provided', () => {
    expect(matchesCapabilities(request, { ...fullMatch, kashrut: ['Rabbanut'] })).toBe(false);
  });

  it('matches when the baker provides ANY one of several acceptable kashrut levels', () => {
    // The request would accept Rabbanut OR Badatz; the baker only does Rabbanut.
    const multi = { ...request, kashrut: 'Rabbanut, Badatz Eda Haredit' };
    expect(matchesCapabilities(multi, { ...fullMatch, kashrut: ['Rabbanut'] })).toBe(true);
  });

  it('does not match when a dietary need is beyond what the baker can do', () => {
    // Baker can do nut-free but not vegan; the request needs both.
    expect(matchesCapabilities(request, { ...fullMatch, dietary: ['nut-free'] })).toBe(false);
  });

  it('a request with no dietary needs fits any baker (empty ⊆ anything)', () => {
    const plain = { ...request, dietary: '' };
    expect(matchesCapabilities(plain, { ...fullMatch, dietary: [] })).toBe(true);
  });

  it('never matches a request with no kashrut set (legacy rows)', () => {
    const legacy = { ...request, kashrut: '' };
    expect(matchesCapabilities(legacy, fullMatch)).toBe(false);
  });

  it('empty capability lists match nothing that requires them', () => {
    expect(matchesCapabilities(request, { areas: [], dietary: [], kashrut: [] })).toBe(false);
  });
});
