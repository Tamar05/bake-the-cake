// The fields a person submits (same shape as the frontend's RequestDraft).
export type RequestDraft = {
  recipient: string;
  occasion: string;
  neededBy: string;
  dietary: string;
  location: string;
};

// How long a reservation is held before it auto-returns to Open (1 hour).
export const RESERVATION_MS = 60 * 60 * 1000;

// A saved request: the draft plus a database id, a timestamp (ms since 1970),
// and its reservation state. `status` is computed from the reservation clock:
// a request counts as reserved only while the 1-hour hold is still running.
export type CakeRequest = RequestDraft & {
  id: string;
  createdAt: number;
  status: 'open' | 'reserved';
  reservedBy: string | null; // baker's name while reserved, else null
  reservedContact: string | null; // baker's phone/email while reserved, else null
  reservedUntil: number | null; // ms-since-1970 the hold ends, else null
};
