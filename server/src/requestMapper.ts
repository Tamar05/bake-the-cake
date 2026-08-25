import { type CakeRequest, RESERVATION_MS } from './types';

// A row exactly as stored in the cake_requests table (snake_case columns).
// The reserved_* columns are null until someone reserves the request.
export type CakeRequestRow = {
  id: string;
  recipient: string;
  occasion: string;
  needed_by: string;
  dietary: string;
  location: string;
  created_at: string; // ISO timestamp from Postgres
  reserved_by: string | null;
  reserved_contact: string | null;
  reserved_at: string | null; // ISO timestamp, or null when open
};

// Turns a database row into the camelCase shape the app uses. The reservation
// clock is resolved here: a row counts as reserved only while its 1-hour hold
// is still running; an expired (or never-set) hold reads as an open request.
export function rowToRequest(row: CakeRequestRow, now: number = Date.now()): CakeRequest {
  const base = {
    id: row.id,
    recipient: row.recipient,
    occasion: row.occasion,
    neededBy: row.needed_by,
    dietary: row.dietary,
    location: row.location,
    createdAt: new Date(row.created_at).getTime(),
  };

  const reservedUntil = row.reserved_at
    ? new Date(row.reserved_at).getTime() + RESERVATION_MS
    : null;
  const isReserved = reservedUntil !== null && reservedUntil > now;

  return isReserved
    ? {
        ...base,
        status: 'reserved',
        reservedBy: row.reserved_by,
        reservedContact: row.reserved_contact,
        reservedUntil,
      }
    : { ...base, status: 'open', reservedBy: null, reservedContact: null, reservedUntil: null };
}
