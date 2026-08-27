import { createClient } from '@supabase/supabase-js';

// What an admin sees about a baker in the verification screen.
export type BakerSummary = {
  id: string;
  displayName: string;
  contact: string | null;
  verified: boolean;
  createdAt: number; // ms since 1970
};

// Thrown by setVerified when no baker has the given id.
export const BAKER_NOT_FOUND = 'BAKER_NOT_FOUND';

// The profiles the admin tools need. A real Supabase-backed store is used in
// production; tests inject an in-memory fake with the same shape.
export type ProfilesStore = {
  listBakers(): Promise<BakerSummary[]>;
  setVerified(id: string, verified: boolean): Promise<BakerSummary>;
  // Contact details for the given profile ids, as an id → contact map. Used to
  // show an admin how to reach the requester behind a stuck request.
  getContacts(ids: string[]): Promise<Record<string, string | null>>;
  // The login emails of every verified baker — used to alert them when a new
  // cake is requested.
  getVerifiedBakerEmails(): Promise<string[]>;
};

type ProfileRow = {
  id: string;
  display_name: string;
  contact: string | null;
  verified_at: string | null;
  created_at: string;
};

function rowToBaker(row: ProfileRow): BakerSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    contact: row.contact,
    verified: row.verified_at != null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function createSupabaseProfilesStore(): ProfilesStore {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  }
  const supabase = createClient(url, key);

  return {
    async listBakers(): Promise<BakerSummary[]> {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, contact, verified_at, created_at')
        .eq('role', 'baker')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as ProfileRow[]).map(rowToBaker);
    },

    async setVerified(id: string, verified: boolean): Promise<BakerSummary> {
      const { data, error } = await supabase
        .from('profiles')
        .update({ verified_at: verified ? new Date().toISOString() : null })
        .eq('id', id)
        .eq('role', 'baker') // only bakers carry a verification state
        .select('id, display_name, contact, verified_at, created_at')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(BAKER_NOT_FOUND);
      return rowToBaker(data as ProfileRow);
    },

    async getContacts(ids: string[]): Promise<Record<string, string | null>> {
      if (ids.length === 0) return {};
      const { data, error } = await supabase
        .from('profiles')
        .select('id, contact')
        .in('id', ids);
      if (error) throw new Error(error.message);
      const map: Record<string, string | null> = {};
      for (const row of data as { id: string; contact: string | null }[]) {
        map[row.id] = row.contact;
      }
      return map;
    },

    async getVerifiedBakerEmails(): Promise<string[]> {
      const { data: bakers, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'baker')
        .not('verified_at', 'is', null);
      if (error) throw new Error(error.message);
      const ids = new Set((bakers as { id: string }[]).map((b) => b.id));
      if (ids.size === 0) return [];
      // The email lives on the auth user, not the profile row.
      const { data, error: usersError } = await supabase.auth.admin.listUsers();
      if (usersError) throw new Error(usersError.message);
      return data.users
        .filter((u) => ids.has(u.id) && u.email)
        .map((u) => u.email as string);
    },
  };
}
