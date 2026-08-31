import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// One browser push subscription, in the shape the browser's
// PushSubscription.toJSON() hands us (flattened): the endpoint URL the push
// service listens on, plus the two keys (p256dh + auth) needed to encrypt a
// message to that device. A baker may have several — one per device/browser
// they turned notifications on in.
export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

// A stored subscription plus the baker it belongs to — what the Phase 2 fan-out
// reads back to send a push (and, if a device is gone, to prune the right row).
export type StoredPushSubscription = PushSubscriptionInput & { userId: string };

// What the endpoints need to store and clear a baker's device subscriptions. A
// real Supabase-backed store is used in production; tests inject an in-memory
// fake with the same shape. (Phase 2 adds a read side to fan a push out to every
// relevant baker.)
export type PushStore = {
  // Records (or refreshes) a device's subscription for this user. Keyed on the
  // endpoint, so re-subscribing the same device updates it rather than piling up.
  saveSubscription(userId: string, sub: PushSubscriptionInput): Promise<void>;
  // Removes one of this user's device subscriptions (by endpoint). Idempotent —
  // clearing one that's already gone is not an error.
  removeSubscription(userId: string, endpoint: string): Promise<void>;
  // Every stored subscription belonging to any of the given users. Used by the
  // Phase 2 fan-out to reach each matching baker's devices.
  getSubscriptionsForUsers(userIds: string[]): Promise<StoredPushSubscription[]>;
};

// Builds a store backed by the Supabase push_subscriptions table. The client is
// created lazily on first use (like the authenticator), so merely constructing
// the store — e.g. as createApp's default in a test — never needs the env vars.
export function createSupabasePushStore(): PushStore {
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
    async saveSubscription(userId, sub) {
      // Upsert on the endpoint: a device that re-subscribes (or moves to another
      // account) overwrites its old row instead of creating a duplicate.
      const { error } = await getClient()
        .from('push_subscriptions')
        .upsert(
          { user_id: userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          { onConflict: 'endpoint' },
        );
      if (error) throw new Error(error.message);
    },

    async removeSubscription(userId, endpoint) {
      // Scope the delete to this user so one baker can never clear another's
      // subscription by guessing an endpoint.
      const { error } = await getClient()
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    },

    async getSubscriptionsForUsers(userIds) {
      if (userIds.length === 0) return [];
      const { data, error } = await getClient()
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth')
        .in('user_id', userIds);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        userId: row.user_id as string,
        endpoint: row.endpoint as string,
        p256dh: row.p256dh as string,
        auth: row.auth as string,
      }));
    },
  };
}
