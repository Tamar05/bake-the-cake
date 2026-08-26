import { createClient } from '@supabase/supabase-js';
import type { CakeRequest, RequestDraft } from './types';
import { rowToRequest, type CakeRequestRow } from './requestMapper';

// Thrown by reserveRequest when the request is already actively reserved, so
// the endpoint can answer 409 instead of a generic error.
export const ALREADY_RESERVED = 'ALREADY_RESERVED';

// Thrown by releaseRequest when the caller is neither the baker who reserved it
// nor an admin, so the endpoint can answer 403.
export const NOT_RESERVER = 'NOT_RESERVER';

// Thrown by deleteRequest when the caller is neither the request's owner nor an
// admin, so the endpoint can answer 403. Legacy anonymous rows (owner_id null)
// have no owner, so only an admin ever clears this check.
export const NOT_OWNER = 'NOT_OWNER';

// Thrown by deleteRequest when no request has the given id, so the endpoint can
// answer 404 instead of a generic error.
export const NOT_FOUND = 'NOT_FOUND';

// Thrown by a lifecycle step (commit/deliver/receive) when the request isn't in
// the state that step needs — e.g. committing something that isn't reserved. The
// endpoint answers 409 (conflict).
export const INVALID_TRANSITION = 'INVALID_TRANSITION';

// The private Supabase Storage bucket that finished-cake photos live in.
export const PHOTO_BUCKET = 'cake-photos';

// An image the server has already validated (type + size), ready to store.
export type PhotoUpload = { buffer: Buffer; contentType: string };

// What the HTTP endpoints need from a store. A real Supabase-backed store is
// used in production; tests inject an in-memory fake with the same shape.
export type RequestsStore = {
  listRequests(): Promise<CakeRequest[]>;
  addRequest(draft: RequestDraft, ownerId: string): Promise<CakeRequest>;
  reserveRequest(
    id: string,
    userId: string,
    name: string,
    contact: string,
  ): Promise<CakeRequest>;
  releaseRequest(id: string, userId: string, isAdmin: boolean): Promise<CakeRequest>;
  commitRequest(id: string, userId: string, isAdmin: boolean): Promise<CakeRequest>;
  deliverRequest(
    id: string,
    userId: string,
    isAdmin: boolean,
    photo?: PhotoUpload,
  ): Promise<CakeRequest>;
  receiveRequest(id: string, userId: string, isAdmin: boolean): Promise<CakeRequest>;
  deleteRequest(id: string, userId: string, isAdmin: boolean): Promise<void>;
  // A short-lived signed URL for a request's finished-cake photo, but only for a
  // viewer allowed to see it (owner / baker / admin). Throws NOT_FOUND when there
  // is no request or no photo, NOT_OWNER when the viewer isn't allowed.
  createPhotoUrl(id: string, viewerId: string, isAdmin: boolean): Promise<string>;
  // Moderation: delete a request's photo (file + path). Admin-gated at the
  // endpoint. Throws NOT_FOUND when there is no such request.
  removePhoto(id: string): Promise<CakeRequest>;
};

// Builds a store backed by the Supabase cake_requests table.
export function createSupabaseStore(): RequestsStore {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  }
  const supabase = createClient(url, key);

  return {
    async listRequests(): Promise<CakeRequest[]> {
      const { data, error } = await supabase
        .from('cake_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as CakeRequestRow[]).map(rowToRequest);
    },

    async addRequest(draft: RequestDraft, ownerId: string): Promise<CakeRequest> {
      const { data, error } = await supabase
        .from('cake_requests')
        .insert({
          recipient: draft.recipient,
          occasion: draft.occasion,
          needed_by: draft.neededBy,
          dietary: draft.dietary,
          location: draft.location,
          contact_phone: draft.contactPhone,
          owner_id: ownerId,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async reserveRequest(
      id: string,
      userId: string,
      name: string,
      contact: string,
    ): Promise<CakeRequest> {
      // Read the current row first so we can refuse an already-active reservation.
      const current = await supabase.from('cake_requests').select('*').eq('id', id).single();
      if (current.error) throw new Error(current.error.message);
      if (rowToRequest(current.data as CakeRequestRow).status === 'reserved') {
        throw new Error(ALREADY_RESERVED);
      }
      const { data, error } = await supabase
        .from('cake_requests')
        .update({
          reserved_by: name,
          reserved_contact: contact,
          reserved_by_user_id: userId,
          reserved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async releaseRequest(id: string, userId: string, isAdmin: boolean): Promise<CakeRequest> {
      // Only the baker who reserved it (or an admin) may release it, and only
      // while it's still reserved or committed — a delivered cake is done.
      const current = await supabase.from('cake_requests').select('*').eq('id', id).single();
      if (current.error) throw new Error(current.error.message);
      const row = current.data as CakeRequestRow;
      const status = rowToRequest(row).status;
      if (status === 'delivered' || status === 'received') throw new Error(INVALID_TRANSITION);
      if (!isAdmin && row.reserved_by_user_id !== userId) {
        throw new Error(NOT_RESERVER);
      }
      const { data, error } = await supabase
        .from('cake_requests')
        .update({
          reserved_by: null,
          reserved_contact: null,
          reserved_by_user_id: null,
          reserved_at: null,
          committed_at: null, // releasing a committed cake returns it fully to open
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async commitRequest(id: string, userId: string, isAdmin: boolean): Promise<CakeRequest> {
      // The baker who holds the reservation (or an admin) turns the 1-hour hold
      // into a lasting commitment. Only valid while the request is still an
      // active reservation.
      const current = await supabase.from('cake_requests').select('*').eq('id', id).maybeSingle();
      if (current.error) throw new Error(current.error.message);
      if (!current.data) throw new Error(NOT_FOUND);
      const row = current.data as CakeRequestRow;
      // State first (request state isn't sensitive), then who's allowed.
      if (rowToRequest(row).status !== 'reserved') throw new Error(INVALID_TRANSITION);
      if (!isAdmin && row.reserved_by_user_id !== userId) throw new Error(NOT_RESERVER);
      const { data, error } = await supabase
        .from('cake_requests')
        .update({ committed_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async deliverRequest(
      id: string,
      userId: string,
      isAdmin: boolean,
      photo?: PhotoUpload,
    ): Promise<CakeRequest> {
      // The baker who committed marks the cake delivered. Only valid from
      // `committed`, and only the baker holding it (or an admin) may do it.
      const current = await supabase.from('cake_requests').select('*').eq('id', id).maybeSingle();
      if (current.error) throw new Error(current.error.message);
      if (!current.data) throw new Error(NOT_FOUND);
      const row = current.data as CakeRequestRow;
      if (rowToRequest(row).status !== 'committed') throw new Error(INVALID_TRANSITION);
      if (!isAdmin && row.reserved_by_user_id !== userId) throw new Error(NOT_RESERVER);

      // An optional finished-cake photo: store it privately, keyed under the
      // request id, and record its path on the row.
      const update: Record<string, string> = { delivered_at: new Date().toISOString() };
      if (photo) {
        const ext =
          photo.contentType === 'image/png'
            ? 'png'
            : photo.contentType === 'image/webp'
              ? 'webp'
              : 'jpg';
        const path = `${id}/${Date.now()}.${ext}`;
        const upload = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, photo.buffer, { contentType: photo.contentType, upsert: false });
        if (upload.error) throw new Error(upload.error.message);
        update.photo_path = path;
      }

      const { data, error } = await supabase
        .from('cake_requests')
        .update(update)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async receiveRequest(id: string, userId: string, isAdmin: boolean): Promise<CakeRequest> {
      // The requester who owns it confirms they received the cake. Only valid
      // from `delivered`, and only the owner (or an admin) may confirm. Legacy
      // rows have no owner, so only an admin can confirm those.
      const current = await supabase.from('cake_requests').select('*').eq('id', id).maybeSingle();
      if (current.error) throw new Error(current.error.message);
      if (!current.data) throw new Error(NOT_FOUND);
      const row = current.data as CakeRequestRow;
      if (rowToRequest(row).status !== 'delivered') throw new Error(INVALID_TRANSITION);
      if (!isAdmin && row.owner_id !== userId) throw new Error(NOT_OWNER);
      const { data, error } = await supabase
        .from('cake_requests')
        .update({ received_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async createPhotoUrl(id: string, viewerId: string, isAdmin: boolean): Promise<string> {
      const current = await supabase
        .from('cake_requests')
        .select('owner_id, reserved_by_user_id, photo_path')
        .eq('id', id)
        .maybeSingle();
      if (current.error) throw new Error(current.error.message);
      if (!current.data) throw new Error(NOT_FOUND);
      const row = current.data as Pick<
        CakeRequestRow,
        'owner_id' | 'reserved_by_user_id' | 'photo_path'
      >;
      // Only the owner, the baker who made it, or an admin may view the photo.
      const maySee =
        isAdmin || row.owner_id === viewerId || row.reserved_by_user_id === viewerId;
      if (!maySee) throw new Error(NOT_OWNER);
      if (!row.photo_path) throw new Error(NOT_FOUND);
      const signed = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(row.photo_path, 60); // valid for 60 seconds
      if (signed.error || !signed.data) throw new Error(signed.error?.message ?? 'Could not sign');
      return signed.data.signedUrl;
    },

    async removePhoto(id: string): Promise<CakeRequest> {
      const current = await supabase.from('cake_requests').select('*').eq('id', id).maybeSingle();
      if (current.error) throw new Error(current.error.message);
      if (!current.data) throw new Error(NOT_FOUND);
      const row = current.data as CakeRequestRow;
      if (row.photo_path) {
        // Best-effort delete of the file; clearing the path is what matters, so
        // a storage hiccup shouldn't block moderation.
        await supabase.storage.from(PHOTO_BUCKET).remove([row.photo_path]);
      }
      const { data, error } = await supabase
        .from('cake_requests')
        .update({ photo_path: null })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async deleteRequest(id: string, userId: string, isAdmin: boolean): Promise<void> {
      // Read the row first so we can answer "not found" and check ownership
      // before deleting. Only the owner (or an admin) may delete; a legacy row
      // with no owner_id can only be deleted by an admin.
      const current = await supabase.from('cake_requests').select('*').eq('id', id).maybeSingle();
      if (current.error) throw new Error(current.error.message);
      if (!current.data) throw new Error(NOT_FOUND);
      const row = current.data as CakeRequestRow;
      if (!isAdmin && row.owner_id !== userId) throw new Error(NOT_OWNER);
      // A requester can't cancel a cake once it's been delivered — it's done.
      // Admins can still remove anything (moderation).
      if (!isAdmin) {
        const status = rowToRequest(row).status;
        if (status === 'delivered' || status === 'received') throw new Error(INVALID_TRANSITION);
      }
      const { error } = await supabase.from('cake_requests').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}
