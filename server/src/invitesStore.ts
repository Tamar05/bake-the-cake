import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// An invite code as the admin screen sees it.
export type InviteCode = {
  id: string;
  code: string;
  note: string | null;
  createdAt: number; // ms since 1970
  revokedAt: number | null; // ms since 1970, or null while still active
};

// Thrown by revokeCode when no code has the given id.
export const CODE_NOT_FOUND = 'CODE_NOT_FOUND';

export type InvitesStore = {
  listCodes(): Promise<InviteCode[]>;
  // Creates a new active code with a fresh random value; note is admin-facing only.
  createCode(note: string, createdBy: string): Promise<InviteCode>;
  revokeCode(id: string): Promise<InviteCode>;
  // Redeems a code for the given profile: flips that profile from baker to
  // requester and records the org name, in a single guarded update — succeeds
  // only when the code is active AND the caller is currently a plain baker
  // (never a requester or admin "redeeming" their way into a role change).
  // Returns whether it succeeded; never throws for an invalid code/state, so
  // the route can give a uniform "not valid" response without distinguishing
  // why (no enumeration of which codes exist).
  redeemCode(code: string, profileId: string, orgName: string): Promise<boolean>;
};

type CodeRow = {
  id: string;
  code: string;
  note: string | null;
  created_at: string;
  revoked_at: string | null;
};

function rowToCode(row: CodeRow): InviteCode {
  return {
    id: row.id,
    code: row.code,
    note: row.note,
    createdAt: new Date(row.created_at).getTime(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at).getTime() : null,
  };
}

// A short, unambiguous code: uppercase letters + digits, no 0/O/1/I, 8 chars —
// easy to read aloud or type by hand when handing it to an organization.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function createSupabaseInvitesStore(): InvitesStore {
  // Lazy client, same pattern as profilesStore/pushStore: the factory itself
  // never throws (so it's safe as a default parameter even when Supabase
  // isn't configured, e.g. in tests that inject a fake store instead), only
  // an actual call does.
  let client: SupabaseClient | null = null;
  function getClient(): SupabaseClient {
    if (!client) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
      }
      client = createClient(url, key);
    }
    return client;
  }

  return {
    async listCodes(): Promise<InviteCode[]> {
      const { data, error } = await getClient()
        .from('invite_codes')
        .select('id, code, note, created_at, revoked_at')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as CodeRow[]).map(rowToCode);
    },

    async createCode(note: string, createdBy: string): Promise<InviteCode> {
      // Collisions are astronomically unlikely at this scale, but guard against
      // one anyway by retrying on a unique-constraint violation.
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await getClient()
          .from('invite_codes')
          .insert({ code: generateCode(), note: note || null, created_by: createdBy })
          .select('id, code, note, created_at, revoked_at')
          .single();
        if (!error) return rowToCode(data as CodeRow);
        if (error.code !== '23505') throw new Error(error.message); // not a unique violation
      }
      throw new Error('Could not generate a unique invite code');
    },

    async revokeCode(id: string): Promise<InviteCode> {
      const { data, error } = await getClient()
        .from('invite_codes')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .select('id, code, note, created_at, revoked_at')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(CODE_NOT_FOUND);
      return rowToCode(data as CodeRow);
    },

    async redeemCode(code: string, profileId: string, orgName: string): Promise<boolean> {
      // One statement: only flips the profile when it is currently a plain
      // baker AND a matching, unrevoked code exists — closes the revoke race
      // (a code revoked just before this commits is guaranteed to block it)
      // and the self-demotion hole (an existing requester/admin can't "join").
      const { data, error } = await getClient().rpc('redeem_invite_code', {
        p_code: code,
        p_profile_id: profileId,
        p_org_name: orgName,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
  };
}
