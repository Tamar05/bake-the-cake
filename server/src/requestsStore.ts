import { createClient } from '@supabase/supabase-js';
import type { CakeRequest, RequestDraft } from './types';
import { rowToRequest, type CakeRequestRow } from './requestMapper';

// Thrown by reserveRequest when the request is already actively reserved, so
// the endpoint can answer 409 instead of a generic error.
export const ALREADY_RESERVED = 'ALREADY_RESERVED';

// What the HTTP endpoints need from a store. A real Supabase-backed store is
// used in production; tests inject an in-memory fake with the same shape.
export type RequestsStore = {
  listRequests(): Promise<CakeRequest[]>;
  addRequest(draft: RequestDraft): Promise<CakeRequest>;
  reserveRequest(id: string, name: string, contact: string): Promise<CakeRequest>;
  releaseRequest(id: string): Promise<CakeRequest>;
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

    async addRequest(draft: RequestDraft): Promise<CakeRequest> {
      const { data, error } = await supabase
        .from('cake_requests')
        .insert({
          recipient: draft.recipient,
          occasion: draft.occasion,
          needed_by: draft.neededBy,
          dietary: draft.dietary,
          location: draft.location,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async reserveRequest(id: string, name: string, contact: string): Promise<CakeRequest> {
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
          reserved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },

    async releaseRequest(id: string): Promise<CakeRequest> {
      const { data, error } = await supabase
        .from('cake_requests')
        .update({ reserved_by: null, reserved_contact: null, reserved_at: null })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },
  };
}
