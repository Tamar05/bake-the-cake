import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler, Request } from 'express';

// The signed-in person, as the server trusts it: derived from a verified token
// and the profiles table — never from anything the browser sends in the body.
export type AuthedProfile = {
  id: string;
  displayName: string;
  role: 'requester' | 'baker' | 'admin';
  contact: string | null;
};

// An Express request that has passed requireAuth carries the verified profile.
export type AuthedRequest = Request & { auth: AuthedProfile };

// Verifies a login token and returns who it belongs to. The real one asks
// Supabase; tests inject a fake with the same shape.
export type Authenticator = {
  verify(token: string): Promise<AuthedProfile | null>;
};

// The production authenticator: validates the token with Supabase Auth, then
// looks up the person's role in the profiles table (server-side, authoritative).
export function createSupabaseAuthenticator(): Authenticator {
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
    async verify(token: string): Promise<AuthedProfile | null> {
      const supabase = getClient();
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) return null; // bad/expired token → fail closed
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, role, contact')
        .eq('id', data.user.id)
        .single();
      if (profileError || !profile) return null; // no profile → fail closed
      return {
        id: profile.id,
        displayName: profile.display_name,
        role: profile.role,
        contact: profile.contact,
      };
    },
  };
}

// Middleware: require a valid Bearer token. Attaches the verified profile to the
// request, or answers 401. This is the single authentication chokepoint.
export function requireAuth(authenticator: Authenticator): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const profile = await authenticator.verify(token);
    if (!profile) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
    (req as AuthedRequest).auth = profile;
    next();
  };
}

// Middleware to run AFTER requireAuth: allow only the listed roles, else 403.
export function requireRole(...roles: AuthedProfile['role'][]): RequestHandler {
  return (req, res, next) => {
    const profile = (req as AuthedRequest).auth;
    if (!profile || !roles.includes(profile.role)) {
      res.status(403).json({ error: 'Your account is not allowed to do this' });
      return;
    }
    next();
  };
}
