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
  contact_phone: string | null; // requester's delivery contact; null for legacy rows
  created_at: string; // ISO timestamp from Postgres
  owner_id: string | null; // the requester who posted it; null for legacy rows
  reserved_by: string | null;
  reserved_contact: string | null;
  reserved_by_user_id: string | null; // the baker's account id, or null
  reserved_at: string | null; // ISO timestamp, or null when open
  committed_at: string | null; // ISO timestamp the baker committed to bake, or null
  delivered_at: string | null; // ISO timestamp the baker marked it delivered, or null
  received_at: string | null; // ISO timestamp the requester confirmed receipt, or null
  photo_path: string | null; // Storage key of the finished-cake photo, or null
  shared_by_owner: boolean | null; // requester agreed to the public gallery
  shared_by_baker: boolean | null; // baker agreed to the public gallery
  gallery_caption: string | null; // optional gallery message
};

// Turns a database row into the camelCase shape the app uses. The lifecycle is
// resolved here: a fresh reservation counts as `reserved` only while its 1-hour
// hold is still running, but once the baker commits (`committed_at` is set) the
// hold no longer matters and the request reads as `committed`. The baker's
// identity is carried while either claimed state holds.
export function rowToRequest(row: CakeRequestRow, now: number = Date.now()): CakeRequest {
  const base = {
    id: row.id,
    recipient: row.recipient,
    occasion: row.occasion,
    neededBy: row.needed_by,
    dietary: row.dietary,
    location: row.location,
    contactPhone: row.contact_phone ?? '', // '' for legacy rows with no phone
    createdAt: new Date(row.created_at).getTime(),
    ownerId: row.owner_id,
  };

  const reservedUntil = row.reserved_at
    ? new Date(row.reserved_at).getTime() + RESERVATION_MS
    : null;
  const holdActive = reservedUntil !== null && reservedUntil > now;
  const committedAt = row.committed_at ? new Date(row.committed_at).getTime() : null;
  const deliveredAt = row.delivered_at ? new Date(row.delivered_at).getTime() : null;
  const receivedAt = row.received_at ? new Date(row.received_at).getTime() : null;

  // Latest step reached wins; the pre-commit hold only counts while it's running.
  const status: CakeRequest['status'] =
    receivedAt !== null
      ? 'received'
      : deliveredAt !== null
        ? 'delivered'
        : committedAt !== null
          ? 'committed'
          : holdActive
            ? 'reserved'
            : 'open';
  // Once a baker has it (any state past open) we keep their identity on the card.
  const claimed = status !== 'open';

  return {
    ...base,
    status,
    reservedBy: claimed ? row.reserved_by : null,
    reservedContact: claimed ? row.reserved_contact : null,
    reservedByUserId: claimed ? row.reserved_by_user_id : null,
    // The countdown is only meaningful during the pre-commit hold.
    reservedUntil: status === 'reserved' ? reservedUntil : null,
    reservedAt: row.reserved_at ? new Date(row.reserved_at).getTime() : null,
    committedAt,
    deliveredAt,
    receivedAt,
    hasPhoto: row.photo_path != null,
    sharedByOwner: row.shared_by_owner ?? false,
    sharedByBaker: row.shared_by_baker ?? false,
    galleryCaption: row.gallery_caption ?? '',
  };
}
