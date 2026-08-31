import { createClient } from '@supabase/supabase-js';

// What an admin sees about a baker in the verification screen.
export type BakerSummary = {
  id: string;
  displayName: string;
  contact: string | null;
  verified: boolean;
  createdAt: number; // ms since 1970
};

// A baker's in-app notification preferences: whether they want to hear about new
// requests, and which areas / dietary needs / kashrut levels they can make.
// seenAt is when they last cleared the bell (ms since 1970, or null if never).
export type NotificationSettings = {
  notifyNewRequests: boolean;
  areas: string[];
  dietary: string[];
  kashrut: string[];
  seenAt: number | null;
};

// The subset a baker actually edits (seenAt is managed by opening the bell).
export type NotificationPrefs = Pick<
  NotificationSettings,
  'notifyNewRequests' | 'areas' | 'dietary' | 'kashrut'
>;

// A verified, opted-in baker with the capabilities the push fan-out matches a
// new request against (Phase 2). Only these bakers are ever considered.
export type NotifiableBaker = {
  id: string;
  areas: string[];
  dietary: string[];
  kashrut: string[];
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
  // A baker's notification preferences (defaults when they've set none).
  getNotificationSettings(userId: string): Promise<NotificationSettings>;
  // Saves a baker's notification preferences and returns the full settings.
  setNotificationSettings(userId: string, prefs: NotificationPrefs): Promise<NotificationSettings>;
  // Records that the baker just looked at the bell, clearing the "new since last
  // seen" count. Returns the new seen timestamp (ms since 1970).
  markNotificationsSeen(userId: string): Promise<number>;
  // Every verified baker who has opted in to new-request notifications, with
  // their capabilities. The Phase 2 push fan-out matches a new request against
  // these (verification + opt-in are already applied here).
  listNotifiableBakers(): Promise<NotifiableBaker[]>;
};

type ProfileRow = {
  id: string;
  display_name: string;
  contact: string | null;
  verified_at: string | null;
  created_at: string;
};

// The notification columns as stored on a profile row.
type NotifyRow = {
  notify_new_requests: boolean | null;
  notify_areas: string[] | null;
  notify_dietary: string[] | null;
  notify_kashrut: string[] | null;
  notifications_seen_at: string | null;
};

const NOTIFY_COLUMNS =
  'notify_new_requests, notify_areas, notify_dietary, notify_kashrut, notifications_seen_at';

function rowToNotificationSettings(row: NotifyRow | null): NotificationSettings {
  return {
    notifyNewRequests: row?.notify_new_requests ?? false,
    areas: row?.notify_areas ?? [],
    dietary: row?.notify_dietary ?? [],
    kashrut: row?.notify_kashrut ?? [],
    seenAt: row?.notifications_seen_at ? new Date(row.notifications_seen_at).getTime() : null,
  };
}

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

    async getNotificationSettings(userId: string): Promise<NotificationSettings> {
      const { data, error } = await supabase
        .from('profiles')
        .select(NOTIFY_COLUMNS)
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return rowToNotificationSettings(data as NotifyRow | null);
    },

    async setNotificationSettings(
      userId: string,
      prefs: NotificationPrefs,
    ): Promise<NotificationSettings> {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          notify_new_requests: prefs.notifyNewRequests,
          notify_areas: prefs.areas,
          notify_dietary: prefs.dietary,
          notify_kashrut: prefs.kashrut,
        })
        .eq('id', userId)
        .select(NOTIFY_COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return rowToNotificationSettings(data as NotifyRow | null);
    },

    async markNotificationsSeen(userId: string): Promise<number> {
      const seenAt = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({ notifications_seen_at: seenAt })
        .eq('id', userId);
      if (error) throw new Error(error.message);
      return new Date(seenAt).getTime();
    },

    async listNotifiableBakers(): Promise<NotifiableBaker[]> {
      // Verified (verified_at set) bakers who opted in — the audience the fan-out
      // then narrows by capability match.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, notify_areas, notify_dietary, notify_kashrut')
        .eq('role', 'baker')
        .not('verified_at', 'is', null)
        .eq('notify_new_requests', true);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id as string,
        areas: (row.notify_areas as string[] | null) ?? [],
        dietary: (row.notify_dietary as string[] | null) ?? [],
        kashrut: (row.notify_kashrut as string[] | null) ?? [],
      }));
    },
  };
}
