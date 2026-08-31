import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import type { Authenticator, AuthedProfile } from './auth';
import type { RequestsStore } from './requestsStore';
import type { ProfilesStore } from './profilesStore';
import type { Translator } from './translator';
import type { PushStore, PushSubscriptionInput } from './pushStore';

// Fake auth: 'bak' is a verified baker, 'bak2' a second (unverified) baker, and
// 'req' a requester. Any other token (or none) is signed-out.
const PROFILES: Record<string, AuthedProfile> = {
  bak: {
    id: 'user-bak',
    displayName: 'Baz',
    role: 'baker',
    contact: 'baz@example.com',
    verified: true,
    email: 'baz@example.com',
  },
  bak2: {
    id: 'user-bak2',
    displayName: 'Bex',
    role: 'baker',
    contact: null,
    verified: false, // unverified — push settings still work, like the bell
    email: 'bex@example.com',
  },
  req: {
    id: 'user-req',
    displayName: 'Rae',
    role: 'requester',
    contact: null,
    verified: false,
    email: 'rae@example.com',
  },
};
function makeFakeAuthenticator(): Authenticator {
  return { async verify(token: string) { return PROFILES[token] ?? null; } };
}

// A record of one stored device subscription, including who it belongs to, so a
// test can assert both idempotency (keyed on endpoint) and per-baker scoping.
type StoredSub = PushSubscriptionInput & { userId: string };

// An in-memory stand-in for the Supabase push_subscriptions store. `rows` is
// exposed so tests can inspect exactly what was saved/removed.
function makeFakePushStore() {
  const rows: StoredSub[] = [];
  const store: PushStore & { rows: StoredSub[] } = {
    rows,
    async saveSubscription(userId, sub) {
      // Upsert on the endpoint: the same device re-subscribing updates its row
      // (and its owner) rather than piling up a duplicate.
      const existing = rows.find((r) => r.endpoint === sub.endpoint);
      if (existing) Object.assign(existing, { userId, ...sub });
      else rows.push({ userId, ...sub });
    },
    async removeSubscription(userId, endpoint) {
      // Scoped to the owner, mirroring the real adapter's `.eq('user_id', …)`.
      const i = rows.findIndex((r) => r.endpoint === endpoint && r.userId === userId);
      if (i >= 0) rows.splice(i, 1);
    },
  };
  return store;
}

// The push endpoints touch only the authenticator and the push store, so the
// requests/profiles stores and translator are unused stubs here.
const stubStore = {} as unknown as RequestsStore;
const stubProfiles = {} as unknown as ProfilesStore;
const stubTranslator: Translator = { async translate(text) { return text; } };

function makeApp(pushStore: PushStore = makeFakePushStore()) {
  return createApp(stubStore, stubTranslator, makeFakeAuthenticator(), stubProfiles, pushStore);
}

const validSub = {
  endpoint: 'https://push.example/device-abc',
  keys: { p256dh: 'p256dh-key-1', auth: 'auth-secret-1' },
};

describe('push subscriptions API', () => {
  const subscribe = (app: ReturnType<typeof createApp>, token: string | undefined, body: unknown = validSub) => {
    const call = request(app).post('/api/me/push-subscriptions');
    if (token) call.set('Authorization', `Bearer ${token}`);
    return call.send(body as object);
  };
  const unsubscribe = (app: ReturnType<typeof createApp>, token: string | undefined, body: unknown) => {
    const call = request(app).delete('/api/me/push-subscriptions');
    if (token) call.set('Authorization', `Bearer ${token}`);
    return call.send(body as object);
  };

  describe('POST (subscribe this device)', () => {
    it('requires signing in (401)', async () => {
      expect((await subscribe(makeApp(), undefined)).status).toBe(401);
    });

    it('is baker-only — a requester is refused (403)', async () => {
      expect((await subscribe(makeApp(), 'req')).status).toBe(403);
    });

    it('saves a valid subscription keyed to the baker (201)', async () => {
      const push = makeFakePushStore();
      const res = await subscribe(makeApp(push), 'bak');
      expect(res.status).toBe(201);
      expect(push.rows).toHaveLength(1);
      expect(push.rows[0]).toEqual({
        userId: 'user-bak',
        endpoint: validSub.endpoint,
        p256dh: validSub.keys.p256dh,
        auth: validSub.keys.auth,
      });
    });

    it('works for an unverified baker too (matches the bell)', async () => {
      const push = makeFakePushStore();
      expect((await subscribe(makeApp(push), 'bak2')).status).toBe(201);
      expect(push.rows[0].userId).toBe('user-bak2');
    });

    it('re-subscribing the same device is idempotent — one row, not two', async () => {
      const push = makeFakePushStore();
      await subscribe(makeApp(push), 'bak');
      await subscribe(makeApp(push), 'bak');
      expect(push.rows).toHaveLength(1);
    });

    it('rejects a malformed body — missing endpoint or keys (400)', async () => {
      const app = makeApp();
      expect((await subscribe(app, 'bak', {})).status).toBe(400);
      expect((await subscribe(app, 'bak', { endpoint: 'https://x/y' })).status).toBe(400); // no keys
      expect((await subscribe(app, 'bak', { endpoint: 'https://x/y', keys: { p256dh: 'k' } })).status).toBe(400); // no auth
      expect((await subscribe(app, 'bak', { endpoint: '', keys: { p256dh: 'k', auth: 'a' } })).status).toBe(400); // empty endpoint
    });

    it('returns 500 when the store fails', async () => {
      const failing: PushStore = {
        async saveSubscription() { throw new Error('db down'); },
        async removeSubscription() {},
      };
      expect((await subscribe(makeApp(failing), 'bak')).status).toBe(500);
    });
  });

  describe('DELETE (unsubscribe this device)', () => {
    it('requires signing in (401)', async () => {
      expect((await unsubscribe(makeApp(), undefined, { endpoint: validSub.endpoint })).status).toBe(401);
    });

    it('is baker-only — a requester is refused (403)', async () => {
      expect((await unsubscribe(makeApp(), 'req', { endpoint: validSub.endpoint })).status).toBe(403);
    });

    it('removes this device’s subscription (204)', async () => {
      const push = makeFakePushStore();
      await subscribe(makeApp(push), 'bak');
      const res = await unsubscribe(makeApp(push), 'bak', { endpoint: validSub.endpoint });
      expect(res.status).toBe(204);
      expect(push.rows).toHaveLength(0);
    });

    it('is idempotent — removing an unknown endpoint still succeeds (204)', async () => {
      const push = makeFakePushStore();
      const res = await unsubscribe(makeApp(push), 'bak', { endpoint: 'https://push.example/never-seen' });
      expect(res.status).toBe(204);
    });

    it('one baker cannot remove another baker’s subscription', async () => {
      const push = makeFakePushStore();
      await subscribe(makeApp(push), 'bak'); // owned by user-bak
      // bak2 tries to delete the same endpoint — scoped delete leaves it intact.
      const res = await unsubscribe(makeApp(push), 'bak2', { endpoint: validSub.endpoint });
      expect(res.status).toBe(204); // idempotent from bak2's view
      expect(push.rows).toHaveLength(1); // …but bak's row survives
      expect(push.rows[0].userId).toBe('user-bak');
    });

    it('rejects a missing endpoint (400)', async () => {
      expect((await unsubscribe(makeApp(), 'bak', {})).status).toBe(400);
    });

    it('returns 500 when the store fails', async () => {
      const failing: PushStore = {
        async saveSubscription() {},
        async removeSubscription() { throw new Error('db down'); },
      };
      expect((await unsubscribe(makeApp(failing), 'bak', { endpoint: validSub.endpoint })).status).toBe(500);
    });
  });
});
