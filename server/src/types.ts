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
// and where it is in its lifecycle. `status` is derived on read (see
// requestMapper): a fresh reservation reads as `reserved` only while the 1-hour
// hold runs, but once a baker commits (`committedAt`) the hold no longer
// expires and the request reads as `committed` until it moves further along.
export type CakeRequest = RequestDraft & {
  id: string;
  createdAt: number;
  ownerId: string | null; // the requester who posted it; null for legacy rows
  status: 'open' | 'reserved' | 'committed' | 'delivered' | 'received';
  reservedBy: string | null; // baker's name while claimed, else null
  reservedContact: string | null; // baker's phone/email while claimed, else null
  reservedByUserId: string | null; // the baker's account id while claimed, else null
  reservedUntil: number | null; // ms-since-1970 the 1-hour hold ends; null once committed
  committedAt: number | null; // ms-since-1970 the baker committed to bake, else null
  deliveredAt: number | null; // ms-since-1970 the baker marked it delivered, else null
  receivedAt: number | null; // ms-since-1970 the requester confirmed receipt, else null
  hasPhoto: boolean; // whether a finished-cake photo exists (the file stays private)
};
