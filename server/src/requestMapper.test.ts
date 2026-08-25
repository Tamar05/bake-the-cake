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
  created_at: '2026-08-20T10:00:00.000Z',
  owner_id: null,
  reserved_by: null,
  reserved_contact: null,
  reserved_by_user_id: null,
  reserved_at: null,
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
      createdAt: Date.parse('2026-08-20T10:00:00.000Z'),
      ownerId: null,
      status: 'open',
      reservedBy: null,
      reservedContact: null,
      reservedByUserId: null,
      reservedUntil: null,
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
});
