import { createClient } from '@supabase/supabase-js';
import type { CakeRequest, RequestDraft } from './types';
import { rowToRequest, type CakeRequestRow } from './requestMapper';

// What the HTTP endpoints need from a store. A real Supabase-backed store is
// used in production; tests inject an in-memory fake with the same shape.
export type RequestsStore = {
  listRequests(): Promise<CakeRequest[]>;
  addRequest(draft: RequestDraft): Promise<CakeRequest>;
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
  };
}
