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

// A baker who can make exactly this request: based in the same town as the
// request, with a small-but-nonzero radius (0km would fail on floating point).
const fullMatch: BakerCapabilities = {
  homeTown: 'Haifa',
  travelRadiusKm: 5,
  dietary: ['nut-free', 'vegan', 'dairy-free'],
  kashrut: ['Badatz Eda Haredit', 'Rabbanut'],
};

describe('matchesCapabilities', () => {
  it('matches when the town is within radius, kashrut and every dietary need are covered', () => {
    expect(matchesCapabilities(request, fullMatch)).toBe(true);
  });

  it('does not match when the request town is outside the baker\'s travel radius', () => {
    // Tel Aviv is roughly 85km from Haifa — well outside a 5km radius.
    expect(matchesCapabilities(request, { ...fullMatch, homeTown: 'Tel Aviv' })).toBe(false);
  });

  it('matches once the radius is widened enough to cover the distance', () => {
    expect(matchesCapabilities(request, { ...fullMatch, homeTown: 'Tel Aviv', travelRadiusKm: 200 })).toBe(
      true,
    );
  });

  it('never matches when the request location does not resolve to a real town', () => {
    // Legacy data, or a requester's own "Other: <free text>" entry.
    const unresolvable = { ...request, location: 'Other: Somewhere' };
    expect(matchesCapabilities(unresolvable, fullMatch)).toBe(false);
  });

  it('never matches when the baker\'s home town does not resolve (should not happen, but is not trusted blindly)', () => {
    expect(matchesCapabilities(request, { ...fullMatch, homeTown: 'Not A Real Town' })).toBe(false);
  });

  it('does not match when the required kashrut level is not provided', () => {
    expect(matchesCapabilities(request, { ...fullMatch, kashrut: ['Rabbanut'] })).toBe(false);
  });

  it('matches only when the baker provides EVERY kashrut level the request lists', () => {
    // The request needs BOTH Rabbanut AND Badatz; a baker who does only one of
    // them is not enough — every listed level is required.
    const multi = { ...request, kashrut: 'Rabbanut, Badatz Eda Haredit' };
    expect(matchesCapabilities(multi, { ...fullMatch, kashrut: ['Rabbanut'] })).toBe(false);
    expect(
      matchesCapabilities(multi, { ...fullMatch, kashrut: ['Rabbanut', 'Badatz Eda Haredit'] }),
    ).toBe(true);
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
    expect(matchesCapabilities(request, { homeTown: '', travelRadiusKm: 0, dietary: [], kashrut: [] })).toBe(
      false,
    );
  });
});
