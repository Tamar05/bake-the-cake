import { describe, it, expect } from 'vitest';
import { rowToRequest, type CakeRequestRow } from './requestMapper';
import { RESERVATION_MS } from './types';

const baseRow: CakeRequestRow = {
  id: 'abc',
  recipient: 'Maya',
  occasion: '8th birthday',
  needed_by: '2026-09-01',
  dietary: 'nut-free',
  location: 'Haifa',
  contact_phone: null,
  created_at: '2026-08-20T10:00:00.000Z',
  owner_id: null,
  reserved_by: null,
  reserved_contact: null,
  reserved_by_user_id: null,
  reserved_at: null,
  committed_at: null,
  delivered_at: null,
  received_at: null,
  photo_path: null,
  shared_by_owner: false,
  shared_by_baker: false,
  gallery_caption: null,
};

describe('rowToRequest', () => {
  it('maps an unreserved row to an open request', () => {
    expect(rowToRequest(baseRow)).toEqual({
      id: 'abc',
      recipient: 'Maya',
      occasion: '8th birthday',
      neededBy: '2026-09-01',
      dietary: 'nut-free',
      location: 'Haifa',
      contactPhone: '',
      createdAt: Date.parse('2026-08-20T10:00:00.000Z'),
      ownerId: null,
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
    });
  });

  it('reads a fresh reservation as reserved, with who and until', () => {
    const reservedAt = '2026-08-20T10:00:00.000Z';
    const now = Date.parse(reservedAt) + 5 * 60 * 1000; // 5 minutes in
    const result = rowToRequest(
      {
        ...baseRow,
        reserved_by: 'Dana',
        reserved_contact: 'dana@example.com',
        reserved_by_user_id: 'user-dana',
        reserved_at: reservedAt,
      },
      now,
    );
    expect(result.status).toBe('reserved');
    expect(result.reservedBy).toBe('Dana');
    expect(result.reservedContact).toBe('dana@example.com');
    expect(result.reservedByUserId).toBe('user-dana');
    expect(result.reservedUntil).toBe(Date.parse(reservedAt) + RESERVATION_MS);
  });

  it('reads an expired reservation as open again', () => {
    const reservedAt = '2026-08-20T10:00:00.000Z';
    const now = Date.parse(reservedAt) + RESERVATION_MS + 1; // just past the hour
    const result = rowToRequest(
      { ...baseRow, reserved_by: 'Dana', reserved_contact: 'dana@example.com', reserved_at: reservedAt },
      now,
    );
    expect(result.status).toBe('open');
    expect(result.reservedBy).toBeNull();
    expect(result.reservedUntil).toBeNull();
  });

  it('reads a committed row as committed — no countdown, but keeps who is baking', () => {
    const reservedAt = '2026-08-20T10:00:00.000Z';
    const committedAt = '2026-08-20T10:30:00.000Z';
    // Well past the 1-hour hold: were it not committed, this would read as open.
    const now = Date.parse(reservedAt) + RESERVATION_MS * 5;
    const result = rowToRequest(
      {
        ...baseRow,
        reserved_by: 'Dana',
        reserved_contact: 'dana@example.com',
        reserved_by_user_id: 'user-dana',
        reserved_at: reservedAt,
        committed_at: committedAt,
      },
      now,
    );
    expect(result.status).toBe('committed');
    expect(result.reservedBy).toBe('Dana'); // still shows the baker
    expect(result.reservedByUserId).toBe('user-dana');
    expect(result.reservedUntil).toBeNull(); // countdown gone once committed
    expect(result.committedAt).toBe(Date.parse(committedAt));
  });

  const claimedRow = {
    ...baseRow,
    reserved_by: 'Dana',
    reserved_contact: 'dana@example.com',
    reserved_by_user_id: 'user-dana',
    reserved_at: '2026-08-20T10:00:00.000Z',
    committed_at: '2026-08-20T10:30:00.000Z',
  };

  it('reads a delivered row as delivered, still showing the baker', () => {
    const result = rowToRequest({ ...claimedRow, delivered_at: '2026-08-22T09:00:00.000Z' });
    expect(result.status).toBe('delivered');
    expect(result.reservedBy).toBe('Dana');
    expect(result.deliveredAt).toBe(Date.parse('2026-08-22T09:00:00.000Z'));
    expect(result.receivedAt).toBeNull();
  });

  it('reads a received row as received (the completed end state)', () => {
    const result = rowToRequest({
      ...claimedRow,
      delivered_at: '2026-08-22T09:00:00.000Z',
      received_at: '2026-08-22T18:00:00.000Z',
    });
    expect(result.status).toBe('received');
    expect(result.deliveredAt).toBe(Date.parse('2026-08-22T09:00:00.000Z'));
    expect(result.receivedAt).toBe(Date.parse('2026-08-22T18:00:00.000Z'));
  });
});
