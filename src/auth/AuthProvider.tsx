import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchMe, type Profile } from '../lib/authApi';
import { saveNotificationSettings } from '../lib/notificationsApi';

type AuthContextValue = {
  configured: boolean; // is Supabase set up in .env
  loading: boolean; // still checking for an existing session
  profileLoading: boolean; // have a session, still fetching the role/profile
  session: Session | null;
  profile: Profile | null;
  // Public sign-up always creates a baker — the DB trigger enforces this
  // server-side regardless of what's sent, so there's no role to pick here.
  // Becoming a requester (an organization) happens separately, by redeeming
  // an invite code on the /join page (see joinAsOrganization in authApi.ts).
  // Resolves with { emailConfirmationRequired } so a caller can tell whether
  // it got a session back immediately, or needs to show a "check your email"
  // state (Phase 4: Supabase can be configured to require email confirmation
  // before issuing a session).
  signUp: (
    email: string,
    password: string,
    displayName: string,
    contact: string,
    notifyAreas?: string[], // bakers pick their areas at sign-up
    notifyKashrut?: string[], // bakers pick their kashrut levels at sign-up
    notifyDietary?: string[], // bakers pick which dietary needs they can bake for
  ) => Promise<{ emailConfirmationRequired: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const configured = supabase !== null;

  // Pick up any existing session on load, and keep in step with login/logout.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Whenever the session changes, load (or clear) the profile from our server.
  // profileLoading stays true from the moment we have a token until the lookup
  // settles, so route guards can wait instead of treating "not loaded yet" as
  // "signed out".
  useEffect(() => {
    const token = session?.access_token;
    if (!token) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetchMe(token)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setProfileLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  async function signUp(
    email: string,
    password: string,
    displayName: string,
    contact: string,
    notifyAreas: string[] = [],
    notifyKashrut: string[] = [],
    notifyDietary: string[] = [],
  ): Promise<{ emailConfirmationRequired: boolean }> {
    if (!supabase) throw new Error('Auth not configured');
    // No role is sent — the server-side signup trigger always makes a baker,
    // regardless of what a client claims (see AuthContextValue's comment).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName, contact } },
    });
    if (error) throw error;
    // Save any capabilities picked at sign-up and opt in. The profile row
    // already exists (the on-signup trigger created it). If Supabase requires
    // email confirmation, signUp returns no session here — nothing to save
    // yet, and the caller shows a "check your email" state instead. Best-
    // effort either way — a failure here never blocks the account; they can
    // adjust it later in Settings.
    const chose = notifyAreas.length > 0 || notifyKashrut.length > 0 || notifyDietary.length > 0;
    if (data.session && chose) {
      try {
        await saveNotificationSettings(
          {
            notifyNewRequests: true,
            areas: notifyAreas,
            dietary: notifyDietary,
            kashrut: notifyKashrut,
          },
          data.session.access_token,
        );
      } catch {
        // ignore — the baker can set these in the Notifications screen
      }
    }
    return { emailConfirmationRequired: data.session == null };
  }

  async function signIn(email: string, password: string): Promise<void> {
    if (!supabase) throw new Error('Auth not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signOut(): Promise<void> {
    if (supabase) await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ configured, loading, profileLoading, session, profile, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
