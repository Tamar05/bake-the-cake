import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The browser's Supabase client, used only for logging in/out. It needs the
// project URL + the PUBLISHABLE (anon) key in the frontend .env — never the
// secret key. If they're missing we export null so the app still runs (the
// auth panel then shows a "not configured yet" notice instead of crashing).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

if (!supabase) {
  console.warn(
    'Supabase auth not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
  );
}
