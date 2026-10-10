import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { fetchMe, type Profile } from '../lib/authApi';

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
  ) => Promise<{ emailConfirmationRequired: boolean }>;
  // Marks the signed-in baker's "finish setting up" step as done (or skipped)
  // so it isn't shown again. Stored on the Supabase user, so it follows them
  // across devices.
  markSetupDone: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Sends a "reset your password" email via Supabase. The link in it brings
  // them back to /reset-password with a temporary recovery session already
  // attached (Supabase's client picks it up from the URL automatically).
  requestPasswordReset: (email: string) => Promise<void>;
  // Sets a new password for whoever the current session belongs to — used on
  // the /reset-password page, where that session is the temporary recovery
  // one from the emailed link.
  updatePassword: (newPassword: string) => Promise<void>;
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
  ): Promise<{ emailConfirmationRequired: boolean }> {
    if (!supabase) throw new Error('Auth not configured');
    // No role is sent — the server-side signup trigger always makes a baker,
    // regardless of what a client claims (see AuthContextValue's comment).
    // emailRedirectTo sends the confirmation link back to the site they signed
    // up on, instead of whatever Site URL is configured in Supabase.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, contact },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
    // The area / kashrut / dietary questions come AFTER confirmation, on the
    // "finish setting up" screen (BakerSetupPage) — there's no session yet here.
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

  async function requestPasswordReset(email: string): Promise<void> {
    if (!supabase) throw new Error('Auth not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async function markSetupDone(): Promise<void> {
    if (!supabase) throw new Error('Auth not configured');
    const { error } = await supabase.auth.updateUser({ data: { setup_done: true } });
    if (error) throw error;
  }

  async function updatePassword(newPassword: string): Promise<void> {
    if (!supabase) throw new Error('Auth not configured');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{
        configured,
        loading,
        profileLoading,
        session,
        profile,
        signUp,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
        markSetupDone,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
