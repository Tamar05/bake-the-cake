import type { CakeRequest } from './types';

// A row exactly as stored in the cake_requests table (snake_case columns).
export type CakeRequestRow = {
  id: string;
  recipient: string;
  occasion: string;
  needed_by: string;
  dietary: string;
  location: string;
  created_at: string; // ISO timestamp from Postgres
};

// Turns a database row into the camelCase shape the app uses.
export function rowToRequest(row: CakeRequestRow): CakeRequest {
  return {
    id: row.id,
    recipient: row.recipient,
    occasion: row.occasion,
    neededBy: row.needed_by,
    dietary: row.dietary,
    location: row.location,
    createdAt: new Date(row.created_at).getTime(),
  };
}
