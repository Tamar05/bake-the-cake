import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import {
  ALREADY_RESERVED,
  NOT_RESERVER,
  NOT_OWNER,
  NOT_FOUND,
  INVALID_TRANSITION,
  type RequestsStore,
} from './requestsStore';
import type { Authenticator, AuthedProfile } from './auth';
import { BAKER_NOT_FOUND, type ProfilesStore, type BakerSummary } from './profilesStore';
import type { Notifier, BakeEmailDetails } from './emailer';
import type { Translator } from './translator';
import { RESERVATION_MS, type CakeRequest, type RequestDraft } from './types';

// An in-memory stand-in for the Supabase store, so these tests need no database.
// An optional seed lets a test start with pre-existing rows (e.g. a legacy row
// with no owner) that the API itself can't create.
function makeFakeStore(seed: CakeRequest[] = []): RequestsStore {
  const items: CakeRequest[] = [...seed];
  const find = (id: string) => items.find((r) => r.id === id);
  return {
    async listRequests() {
      return [...items].sort((a, b) => b.createdAt - a.createdAt);
    },
    async addRequest(draft: RequestDraft, ownerId: string) {
      const saved: CakeRequest = {
        ...draft,
        id: `id-${items.length + 1}`,
        createdAt: Date.now() + items.length,
        ownerId,
        status: 'open',
        reservedBy: null,
        reservedContact: null,
        reservedByUserId: null,
        reservedUntil: null,
        reservedAt: null,
        committedAt: null,
        deliveredAt: null,
        receivedAt: null,
        hasPhoto: false,
      };
      items.push(saved);
      return saved;
    },
    async reserveRequest(id, userId, name, contact) {
      const item = find(id);
      if (!item) throw new Error('not found');
      if (item.status === 'reserved' || item.status === 'committed') {
        throw new Error(ALREADY_RESERVED);
      }
      Object.assign(item, {
        status: 'reserved',
        reservedBy: name,
        reservedContact: contact,
        reservedByUserId: userId,
        reservedUntil: Date.now() + RESERVATION_MS,
        reservedAt: Date.now(),
        committedAt: null,
      });
      return item;
    },
    async releaseRequest(id, userId, isAdmin) {
      const item = find(id);
      if (!item) throw new Error('not found');
      if (item.status === 'delivered' || item.status === 'received') {
        throw new Error(INVALID_TRANSITION);
      }
      if (!isAdmin && item.reservedByUserId !== userId) throw new Error(NOT_RESERVER);
      Object.assign(item, {
        status: 'open',
        reservedBy: null,
        reservedContact: null,
        reservedByUserId: null,
        reservedUntil: null,
        committedAt: null,
      });
      return item;
    },
    async commitRequest(id, userId, isAdmin) {
      const item = find(id);
      if (!item) throw new Error(NOT_FOUND);
      if (item.status !== 'reserved') throw new Error(INVALID_TRANSITION);
      if (!isAdmin && item.reservedByUserId !== userId) throw new Error(NOT_RESERVER);
      Object.assign(item, {
        status: 'committed',
        reservedUntil: null,
        committedAt: Date.now(),
      });
      return item;
    },
    async deliverRequest(id, userId, isAdmin, photo) {
      const item = find(id);
      if (!item) throw new Error(NOT_FOUND);
      if (item.status !== 'committed') throw new Error(INVALID_TRANSITION);
      if (!isAdmin && item.reservedByUserId !== userId) throw new Error(NOT_RESERVER);
      Object.assign(item, {
        status: 'delivered',
        deliveredAt: Date.now(),
        hasPhoto: item.hasPhoto || photo != null,
      });
      return item;
    },
    async receiveRequest(id, userId, isAdmin) {
      const item = find(id);
      if (!item) throw new Error(NOT_FOUND);
      if (item.status !== 'delivered') throw new Error(INVALID_TRANSITION);
      if (!isAdmin && item.ownerId !== userId) throw new Error(NOT_OWNER);
      Object.assign(item, { status: 'received', receivedAt: Date.now() });
      return item;
    },
    async createPhotoUrl(id, viewerId, isAdmin) {
      const item = find(id);
      if (!item) throw new Error(NOT_FOUND);
      const maySee = isAdmin || item.ownerId === viewerId || item.reservedByUserId === viewerId;
      if (!maySee) throw new Error(NOT_OWNER);
      if (!item.hasPhoto) throw new Error(NOT_FOUND);
      return `https://fake.storage/${id}.jpg`;
    },
    async removePhoto(id) {
      const item = find(id);
      if (!item) throw new Error(NOT_FOUND);
      item.hasPhoto = false;
      return item;
    },
    async deleteRequest(id, userId, isAdmin) {
      const item = find(id);
      if (!item) throw new Error(NOT_FOUND);
      if (!isAdmin && item.ownerId !== userId) throw new Error(NOT_OWNER);
      if (!isAdmin && (item.status === 'delivered' || item.status === 'received')) {
        throw new Error(INVALID_TRANSITION);
      }
      items.splice(items.indexOf(item), 1);
    },
  };
}

// An in-memory stand-in for the real MyMemory translator.
function makeFakeTranslator(): Translator {
  return {
    async translate(text: string, _from: string, to: string) {
      return `[${to}] ${text}`;
    },
  };
}

// Fake auth: the tokens 'req' / 'bak' / 'adm' stand for a signed-in requester /
// baker / admin; any other token (or none) is treated as signed-out.
const PROFILES: Record<string, AuthedProfile> = {
  req: {
    id: 'user-req',
    displayName: 'Rae',
    role: 'requester',
    contact: null,
    verified: false,
    email: 'rae@example.com',
  },
  req2: {
    id: 'user-req2',
    displayName: 'Ravi',
    role: 'requester',
    contact: null,
    verified: false,
    email: 'ravi@example.com',
  },
  bak: {
    id: 'user-bak',
    displayName: 'Baz',
    role: 'baker',
    contact: 'baz@example.com',
    verified: true,
    email: 'baz.baker@example.com',
  },
  bak2: {
    id: 'user-bak2',
    displayName: 'Bex',
    role: 'baker',
    contact: 'bex@example.com',
    verified: true,
    email: 'bex.baker@example.com',
  },
  // An unverified baker: signed in, but not yet vetted by an admin.
  bakU: {
    id: 'user-bakU',
    displayName: 'Uma',
    role: 'baker',
    contact: 'uma@example.com',
    verified: false,
    email: 'uma.baker@example.com',
  },
  adm: {
    id: 'user-adm',
    displayName: 'Ada',
    role: 'admin',
    contact: null,
    verified: false,
    email: 'ada.admin@example.com',
  },
};
function makeFakeAuthenticator(): Authenticator {
  return {
    async verify(token: string) {
      return PROFILES[token] ?? null;
    },
  };
}

// An in-memory stand-in for the profiles store, seeded with the fake bakers.
function makeFakeProfilesStore(): ProfilesStore {
  const bakers: BakerSummary[] = [
    { id: 'user-bak', displayName: 'Baz', contact: 'baz@example.com', verified: true, createdAt: 1 },
    { id: 'user-bak2', displayName: 'Bex', contact: 'bex@example.com', verified: true, createdAt: 2 },
    { id: 'user-bakU', displayName: 'Uma', contact: 'uma@example.com', verified: false, createdAt: 3 },
  ];
  return {
    async listBakers() {
      return bakers.map((b) => ({ ...b }));
    },
    async setVerified(id, verified) {
      const baker = bakers.find((b) => b.id === id);
      if (!baker) throw new Error(BAKER_NOT_FOUND);
      baker.verified = verified;
      return { ...baker };
    },
    async getContacts(ids) {
      const known: Record<string, string | null> = {
        'user-req': 'rae@example.com',
        'user-req2': 'ravi@example.com',
      };
      const map: Record<string, string | null> = {};
      for (const id of ids) if (id in known) map[id] = known[id];
      return map;
    },
  };
}

// A notifier that records what it was asked to send, so tests can inspect it.
function makeFakeNotifier(): { notifier: Notifier; sent: { to: string; details: BakeEmailDetails }[] } {
  const sent: { to: string; details: BakeEmailDetails }[] = [];
  return {
    notifier: {
      async sendBakeConfirmation(to, details) {
        sent.push({ to, details });
      },
    },
    sent,
  };
}

function makeApp() {
  return createApp(
    makeFakeStore(),
    makeFakeTranslator(),
    makeFakeAuthenticator(),
    makeFakeProfilesStore(),
    makeFakeNotifier().notifier,
  );
}

const validDraft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
};

describe('requests API', () => {
  it('GET /api/requests starts empty', async () => {
    const res = await request(makeApp()).get('/api/requests');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('a requester can post a request; it is owned by them', async () => {
    const res = await request(makeApp())
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send(validDraft);
    expect(res.status).toBe(201);
    expect(res.body.recipient).toBe('Maya');
    expect(res.body.id).toBeTruthy();
    expect(res.body.ownerId).toBe('user-req');
  });

  it('a saved request then appears in the list', async () => {
    const app = makeApp();
    await request(app).post('/api/requests').set('Authorization', 'Bearer req').send(validDraft);
    const res = await request(app).get('/api/requests');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].recipient).toBe('Maya');
  });

  it('posting without signing in returns 401', async () => {
    const res = await request(makeApp()).post('/api/requests').send(validDraft);
    expect(res.status).toBe(401);
  });

  it('a baker may not post a request (403)', async () => {
    const res = await request(makeApp())
      .post('/api/requests')
      .set('Authorization', 'Bearer bak')
      .send(validDraft);
    expect(res.status).toBe(403);
  });

  it('a requester posting a blank form returns 400', async () => {
    const res = await request(makeApp())
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send({ recipient: '', occasion: '', neededBy: '', dietary: '', location: '' });
    expect(res.status).toBe(400);
  });
});

describe('reserve API', () => {
  async function addOne(app: ReturnType<typeof createApp>) {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send(validDraft);
    return res.body.id as string;
  }
  const reserve = (app: ReturnType<typeof createApp>, id: string, token: string) =>
    request(app).post(`/api/requests/${id}/reserve`).set('Authorization', `Bearer ${token}`).send();
  const release = (app: ReturnType<typeof createApp>, id: string, token: string) =>
    request(app).post(`/api/requests/${id}/release`).set('Authorization', `Bearer ${token}`).send();

  it('a baker reserves with one click; details come from their profile', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const res = await reserve(app, id, 'bak');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reserved');
    expect(res.body.reservedBy).toBe('Baz');
    expect(res.body.reservedContact).toBe('baz@example.com');
    expect(res.body.reservedByUserId).toBe('user-bak');
    expect(res.body.reservedUntil).toBeGreaterThan(Date.now());
  });

  it('reserving without signing in returns 401', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const res = await request(app).post(`/api/requests/${id}/reserve`).send();
    expect(res.status).toBe(401);
  });

  it('a requester may not reserve (403)', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const res = await reserve(app, id, 'req');
    expect(res.status).toBe(403);
  });

  it('reserving an already-reserved request returns 409', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    const res = await reserve(app, id, 'bak2');
    expect(res.status).toBe(409);
  });

  it('the baker who reserved it can release it back to open', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    const res = await release(app, id, 'bak');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
    expect(res.body.reservedByUserId).toBeNull();
  });

  it('a different baker cannot release someone else’s reservation (403)', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    const res = await release(app, id, 'bak2');
    expect(res.status).toBe(403);
  });

  it('an admin can release anyone’s reservation', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    const res = await release(app, id, 'adm');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
  });

  it('reveals the reserver only to the reserver, the owner, and admins', async () => {
    const app = makeApp();
    const id = await addOne(app); // owner = user-req
    await reserve(app, id, 'bak'); // reserver = Baz (user-bak)

    const seen = async (token?: string) => {
      const call = request(app).get('/api/requests');
      const res = token ? await call.set('Authorization', `Bearer ${token}`) : await call;
      return res.body.find((r: { id: string }) => r.id === id);
    };

    expect((await seen()).reservedBy).toBeNull(); // anonymous browser
    expect((await seen('bak2')).reservedBy).toBeNull(); // an unrelated baker
    expect((await seen('bak')).reservedBy).toBe('Baz'); // the reserver
    expect((await seen('req')).reservedBy).toBe('Baz'); // the requester who posted it
    expect((await seen('adm')).reservedBy).toBe('Baz'); // an admin
    // Everyone still sees that it's reserved, with the countdown.
    const anon = await seen();
    expect(anon.status).toBe('reserved');
    expect(anon.reservedUntil).toBeGreaterThan(Date.now());
  });
});

describe('commit API', () => {
  const addOne = async (app: ReturnType<typeof createApp>) => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send(validDraft);
    return res.body.id as string;
  };
  const reserve = (app: ReturnType<typeof createApp>, id: string, token: string) =>
    request(app).post(`/api/requests/${id}/reserve`).set('Authorization', `Bearer ${token}`).send();
  const commit = (app: ReturnType<typeof createApp>, id: string, token: string) =>
    request(app).post(`/api/requests/${id}/commit`).set('Authorization', `Bearer ${token}`).send();

  it('the baker who reserved it can commit; the countdown stops', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    const res = await commit(app, id, 'bak');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('committed');
    expect(res.body.reservedByUserId).toBe('user-bak');
    expect(res.body.reservedUntil).toBeNull();
    expect(res.body.committedAt).toBeGreaterThan(0);
  });

  it('committing without signing in returns 401', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    const res = await request(app).post(`/api/requests/${id}/commit`).send();
    expect(res.status).toBe(401);
  });

  it('a requester cannot commit (403)', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    expect((await commit(app, id, 'req')).status).toBe(403);
  });

  it('a baker who did not reserve it cannot commit (403)', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    expect((await commit(app, id, 'bak2')).status).toBe(403);
  });

  it('committing a request that is not reserved returns 409', async () => {
    const app = makeApp();
    const id = await addOne(app); // still open
    expect((await commit(app, id, 'bak')).status).toBe(409);
  });

  it('committing an already-committed request returns 409', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    await commit(app, id, 'bak');
    expect((await commit(app, id, 'bak')).status).toBe(409);
  });

  it('an admin can commit a reservation', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    expect((await commit(app, id, 'adm')).status).toBe(200);
  });

  it('a committed request can be released back to open', async () => {
    const app = makeApp();
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    await commit(app, id, 'bak');
    const res = await request(app)
      .post(`/api/requests/${id}/release`)
      .set('Authorization', 'Bearer bak')
      .send();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
    expect(res.body.committedAt).toBeNull();
  });

  it('emails the baker the request details (location + requester contact) on commit', async () => {
    const { notifier, sent } = makeFakeNotifier();
    const app = createApp(
      makeFakeStore(),
      makeFakeTranslator(),
      makeFakeAuthenticator(),
      makeFakeProfilesStore(),
      notifier,
    );
    const id = await addOne(app); // posted by 'req' (owner user-req)
    await reserve(app, id, 'bak');
    await commit(app, id, 'bak');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('baz.baker@example.com'); // the baker's login email
    expect(sent[0].details.location).toBe(validDraft.location);
    expect(sent[0].details.recipient).toBe(validDraft.recipient);
    expect(sent[0].details.requesterContact).toBe('rae@example.com'); // owner's contact
  });

  it('a failed notification does not break the commit', async () => {
    const throwing: Notifier = {
      async sendBakeConfirmation() {
        throw new Error('mail server down');
      },
    };
    const app = createApp(
      makeFakeStore(),
      makeFakeTranslator(),
      makeFakeAuthenticator(),
      makeFakeProfilesStore(),
      throwing,
    );
    const id = await addOne(app);
    await reserve(app, id, 'bak');
    const res = await commit(app, id, 'bak');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('committed');
  });
});

describe('deliver & receive API', () => {
  const post = (app: ReturnType<typeof createApp>, path: string, token?: string) => {
    const call = request(app).post(path);
    return token ? call.set('Authorization', `Bearer ${token}`).send() : call.send();
  };
  // Walk a fresh request all the way to `committed`, held by baker 'bak'.
  const toCommitted = async (app: ReturnType<typeof createApp>) => {
    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send(validDraft);
    const id = created.body.id as string;
    await post(app, `/api/requests/${id}/reserve`, 'bak');
    await post(app, `/api/requests/${id}/commit`, 'bak');
    return id;
  };
  const deliver = (app: ReturnType<typeof createApp>, id: string, token?: string) =>
    post(app, `/api/requests/${id}/deliver`, token);
  const receive = (app: ReturnType<typeof createApp>, id: string, token?: string) =>
    post(app, `/api/requests/${id}/receive`, token);

  it('the baker baking it marks it delivered', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    const res = await deliver(app, id, 'bak');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
    expect(res.body.deliveredAt).toBeGreaterThan(0);
  });

  it('delivering needs a token (401), the right role (requester → 403), and the right baker (bak2 → 403)', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    expect((await deliver(app, id)).status).toBe(401);
    expect((await deliver(app, id, 'req')).status).toBe(403);
    expect((await deliver(app, id, 'bak2')).status).toBe(403);
  });

  it('cannot deliver a request that is not committed (409)', async () => {
    const app = makeApp();
    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send(validDraft);
    const id = created.body.id as string;
    await post(app, `/api/requests/${id}/reserve`, 'bak'); // reserved, not committed
    expect((await deliver(app, id, 'bak')).status).toBe(409);
  });

  it('an admin can mark delivered, and a delivered cake can no longer be released (409)', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    expect((await deliver(app, id, 'adm')).status).toBe(200);
    expect((await post(app, `/api/requests/${id}/release`, 'bak')).status).toBe(409);
  });

  it('the requester who owns it confirms receipt', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    await deliver(app, id, 'bak');
    const res = await receive(app, id, 'req');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('received');
    expect(res.body.receivedAt).toBeGreaterThan(0);
  });

  it('confirming needs a token (401) and the owner — anyone who is not the owner is refused (403)', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    await deliver(app, id, 'bak');
    expect((await receive(app, id)).status).toBe(401);
    expect((await receive(app, id, 'bak')).status).toBe(403); // the baker who made it is not the owner
    expect((await receive(app, id, 'req2')).status).toBe(403); // a different requester
  });

  it('the owner can confirm even if their account role is baker (auth is by ownership, not role)', async () => {
    // A single account that both owns a request and baked it (its role happens to
    // be baker). It must still be able to confirm receipt of its own cake.
    const ownedByBaker: CakeRequest = {
      ...validDraft,
      id: 'owned-by-baker',
      createdAt: Date.now(),
      ownerId: 'user-bak',
      status: 'delivered',
      reservedBy: 'Baz',
      reservedContact: 'baz@example.com',
      reservedByUserId: 'user-bak',
      reservedUntil: null,
      reservedAt: Date.now(),
      committedAt: Date.now(),
      deliveredAt: Date.now(),
      receivedAt: null,
      hasPhoto: false,
    };
    const app = createApp(
      makeFakeStore([ownedByBaker]),
      makeFakeTranslator(),
      makeFakeAuthenticator(),
      makeFakeProfilesStore(),
    );
    const res = await receive(app, 'owned-by-baker', 'bak');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('received');
  });

  it('cannot confirm receipt before delivery (409)', async () => {
    const app = makeApp();
    const id = await toCommitted(app); // committed, not delivered
    expect((await receive(app, id, 'req')).status).toBe(409);
  });

  it('an admin can confirm receipt', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    await deliver(app, id, 'bak');
    expect((await receive(app, id, 'adm')).status).toBe(200);
  });

  it('a delivered legacy request (no owner) can only be confirmed by an admin', async () => {
    const legacy: CakeRequest = {
      ...validDraft,
      id: 'legacy-d',
      createdAt: Date.now(),
      ownerId: null,
      status: 'delivered',
      reservedBy: 'Baz',
      reservedContact: 'baz@example.com',
      reservedByUserId: 'user-bak',
      reservedUntil: null,
      reservedAt: Date.now(),
      committedAt: Date.now(),
      deliveredAt: Date.now(),
      receivedAt: null,
      hasPhoto: false,
    };
    const makeSeeded = () =>
      createApp(makeFakeStore([legacy]), makeFakeTranslator(), makeFakeAuthenticator(), makeFakeProfilesStore());
    expect((await receive(makeSeeded(), 'legacy-d', 'req')).status).toBe(403);
    expect((await receive(makeSeeded(), 'legacy-d', 'adm')).status).toBe(200);
  });
});

describe('photo API', () => {
  const toCommitted = async (app: ReturnType<typeof createApp>) => {
    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send(validDraft);
    const id = created.body.id as string;
    await request(app).post(`/api/requests/${id}/reserve`).set('Authorization', 'Bearer bak').send();
    await request(app).post(`/api/requests/${id}/commit`).set('Authorization', 'Bearer bak').send();
    return id;
  };
  const getPhoto = (app: ReturnType<typeof createApp>, id: string, token?: string) => {
    const call = request(app).get(`/api/requests/${id}/photo`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  };

  it('a photo attached at delivery is stored and visible to the owner', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    const delivered = await request(app)
      .post(`/api/requests/${id}/deliver`)
      .set('Authorization', 'Bearer bak')
      .attach('photo', Buffer.from('fake-image-bytes'), {
        filename: 'cake.jpg',
        contentType: 'image/jpeg',
      });
    expect(delivered.status).toBe(200);
    expect(delivered.body.hasPhoto).toBe(true);
    const photo = await getPhoto(app, id, 'req'); // the owner
    expect(photo.status).toBe(200);
    expect(photo.body.url).toContain('http');
  });

  it('delivering without a photo leaves hasPhoto false and the photo endpoint 404s', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    const delivered = await request(app)
      .post(`/api/requests/${id}/deliver`)
      .set('Authorization', 'Bearer bak')
      .send();
    expect(delivered.body.hasPhoto).toBe(false);
    expect((await getPhoto(app, id, 'req')).status).toBe(404);
  });

  it('the photo is private: no token 401, an unrelated baker 403, the baker and admin allowed', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    await request(app)
      .post(`/api/requests/${id}/deliver`)
      .set('Authorization', 'Bearer bak')
      .attach('photo', Buffer.from('x'), { filename: 'c.png', contentType: 'image/png' });
    expect((await getPhoto(app, id)).status).toBe(401);
    expect((await getPhoto(app, id, 'bak2')).status).toBe(403);
    expect((await getPhoto(app, id, 'bak')).status).toBe(200);
    expect((await getPhoto(app, id, 'adm')).status).toBe(200);
  });

  it('rejects a non-image upload with 400', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    const res = await request(app)
      .post(`/api/requests/${id}/deliver`)
      .set('Authorization', 'Bearer bak')
      .attach('photo', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
  });

  it('an admin can remove a photo; a baker cannot; no token 401', async () => {
    const app = makeApp();
    const id = await toCommitted(app);
    await request(app)
      .post(`/api/requests/${id}/deliver`)
      .set('Authorization', 'Bearer bak')
      .attach('photo', Buffer.from('x'), { filename: 'c.png', contentType: 'image/png' });
    // a baker cannot moderate
    expect(
      (await request(app).delete(`/api/requests/${id}/photo`).set('Authorization', 'Bearer bak'))
        .status,
    ).toBe(403);
    // no token
    expect((await request(app).delete(`/api/requests/${id}/photo`)).status).toBe(401);
    // admin removes it
    const removed = await request(app)
      .delete(`/api/requests/${id}/photo`)
      .set('Authorization', 'Bearer adm');
    expect(removed.status).toBe(200);
    expect(removed.body.hasPhoto).toBe(false);
    // and the photo is now gone
    expect((await getPhoto(app, id, 'req')).status).toBe(404);
  });

  it('removing a photo from a missing request returns 404', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/api/requests/nope/photo')
      .set('Authorization', 'Bearer adm');
    expect(res.status).toBe(404);
  });
});

describe('delete API', () => {
  const addOne = async (app: ReturnType<typeof createApp>, token = 'req') => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .send(validDraft);
    return res.body.id as string;
  };
  const del = (app: ReturnType<typeof createApp>, id: string, token?: string) => {
    const call = request(app).delete(`/api/requests/${id}`);
    return token ? call.set('Authorization', `Bearer ${token}`) : call.send();
  };
  const idsInList = async (app: ReturnType<typeof createApp>) => {
    const res = await request(app).get('/api/requests');
    return (res.body as { id: string }[]).map((r) => r.id);
  };

  it('the owner can delete their own request; it then leaves the list', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const res = await del(app, id, 'req');
    expect(res.status).toBe(204);
    expect(await idsInList(app)).not.toContain(id);
  });

  it('another requester cannot delete a request they do not own (403)', async () => {
    const app = makeApp();
    const id = await addOne(app); // owned by user-req
    const res = await del(app, id, 'req2');
    expect(res.status).toBe(403);
    expect(await idsInList(app)).toContain(id); // still there
  });

  it('a baker cannot delete a request (403)', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const res = await del(app, id, 'bak');
    expect(res.status).toBe(403);
  });

  it('an admin can delete anyone’s request', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const res = await del(app, id, 'adm');
    expect(res.status).toBe(204);
    expect(await idsInList(app)).not.toContain(id);
  });

  it('deleting without signing in returns 401', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const res = await del(app, id);
    expect(res.status).toBe(401);
  });

  it('deleting a request that does not exist returns 404', async () => {
    const res = await del(makeApp(), 'no-such-id', 'adm');
    expect(res.status).toBe(404);
  });

  it('a requester cannot cancel a delivered cake (409), but an admin can still remove it', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const asBak = (action: string) =>
      request(app).post(`/api/requests/${id}/${action}`).set('Authorization', 'Bearer bak').send();
    await asBak('reserve');
    await asBak('commit');
    await asBak('deliver');
    expect((await del(app, id, 'req')).status).toBe(409); // owner can't cancel a delivered cake
    expect(await idsInList(app)).toContain(id); // still there
    expect((await del(app, id, 'adm')).status).toBe(204); // admin can remove it
  });

  it('a legacy request with no owner can only be deleted by an admin', async () => {
    const legacy: CakeRequest = {
      ...validDraft,
      id: 'legacy-1',
      createdAt: Date.now(),
      ownerId: null,
      status: 'open',
      reservedBy: null,
      reservedContact: null,
      reservedByUserId: null,
      reservedUntil: null,
      reservedAt: null,
      committedAt: null,
      deliveredAt: null,
      receivedAt: null,
      hasPhoto: false,
    };
    const makeSeeded = () =>
      createApp(makeFakeStore([legacy]), makeFakeTranslator(), makeFakeAuthenticator(), makeFakeProfilesStore());

    // A signed-in requester is not the owner of an unowned row → 403.
    expect((await del(makeSeeded(), 'legacy-1', 'req')).status).toBe(403);
    // An admin can remove it.
    expect((await del(makeSeeded(), 'legacy-1', 'adm')).status).toBe(204);
  });
});

// The security contract, gathered in one place: every protected endpoint must
// reject a missing token (401), an invalid/expired token (401), the wrong role
// (403), and acting on a request that isn't yours (403). Some of these overlap
// the feature tests above; keeping the full matrix here documents the guarantee.
describe('auth negative tests (Phase 5 hardening)', () => {
  const add = async (app: ReturnType<typeof createApp>) => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send(validDraft);
    return res.body.id as string;
  };
  const reserveAs = (app: ReturnType<typeof createApp>, id: string, token: string) =>
    request(app).post(`/api/requests/${id}/reserve`).set('Authorization', `Bearer ${token}`).send();

  describe('a missing token is rejected with 401', () => {
    it('GET /api/me', async () => {
      expect((await request(makeApp()).get('/api/me')).status).toBe(401);
    });
    it('POST /api/requests', async () => {
      expect((await request(makeApp()).post('/api/requests').send(validDraft)).status).toBe(401);
    });
    it('POST /api/requests/:id/reserve', async () => {
      const app = makeApp();
      const id = await add(app);
      expect((await request(app).post(`/api/requests/${id}/reserve`).send()).status).toBe(401);
    });
    it('POST /api/requests/:id/release', async () => {
      const app = makeApp();
      const id = await add(app);
      expect((await request(app).post(`/api/requests/${id}/release`).send()).status).toBe(401);
    });
    it('DELETE /api/requests/:id', async () => {
      const app = makeApp();
      const id = await add(app);
      expect((await request(app).delete(`/api/requests/${id}`)).status).toBe(401);
    });
  });

  describe('an invalid/expired token is rejected with 401', () => {
    const bad = 'Bearer not-a-real-token';
    it('GET /api/me', async () => {
      expect((await request(makeApp()).get('/api/me').set('Authorization', bad)).status).toBe(401);
    });
    it('POST /api/requests', async () => {
      const res = await request(makeApp())
        .post('/api/requests')
        .set('Authorization', bad)
        .send(validDraft);
      expect(res.status).toBe(401);
    });
    it('DELETE /api/requests/:id', async () => {
      const app = makeApp();
      const id = await add(app);
      const res = await request(app).delete(`/api/requests/${id}`).set('Authorization', bad);
      expect(res.status).toBe(401);
    });
  });

  describe('the wrong role is rejected with 403', () => {
    it('a baker cannot post a request', async () => {
      const res = await request(makeApp())
        .post('/api/requests')
        .set('Authorization', 'Bearer bak')
        .send(validDraft);
      expect(res.status).toBe(403);
    });
    it('a requester cannot reserve a request', async () => {
      const app = makeApp();
      const id = await add(app);
      expect((await reserveAs(app, id, 'req')).status).toBe(403);
    });
  });

  describe('acting on a request that isn’t yours is rejected with 403', () => {
    it('a baker cannot release another baker’s reservation', async () => {
      const app = makeApp();
      const id = await add(app);
      await reserveAs(app, id, 'bak');
      const res = await request(app)
        .post(`/api/requests/${id}/release`)
        .set('Authorization', 'Bearer bak2')
        .send();
      expect(res.status).toBe(403);
    });
    it('a signed-in requester cannot release a baker’s reservation', async () => {
      const app = makeApp();
      const id = await add(app);
      await reserveAs(app, id, 'bak');
      const res = await request(app)
        .post(`/api/requests/${id}/release`)
        .set('Authorization', 'Bearer req')
        .send();
      expect(res.status).toBe(403);
    });
    it('a requester cannot delete another requester’s request', async () => {
      const app = makeApp();
      const id = await add(app);
      expect((await request(app).delete(`/api/requests/${id}`).set('Authorization', 'Bearer req2')).status).toBe(403);
    });
  });
});

describe('verification & bakers API', () => {
  const addOne = async (app: ReturnType<typeof createApp>) => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send(validDraft);
    return res.body.id as string;
  };
  const reserve = (app: ReturnType<typeof createApp>, id: string, token: string) =>
    request(app).post(`/api/requests/${id}/reserve`).set('Authorization', `Bearer ${token}`).send();

  it('an unverified baker cannot reserve (403), but a verified one and an admin can', async () => {
    const app = makeApp();
    const id = await addOne(app);
    expect((await reserve(app, id, 'bakU')).status).toBe(403); // awaiting verification
    expect((await reserve(app, id, 'bak')).status).toBe(200); // verified baker
  });

  it('an admin (never needing verification) can reserve', async () => {
    const app = makeApp();
    const id = await addOne(app);
    expect((await reserve(app, id, 'adm')).status).toBe(200);
  });

  it('GET /api/bakers is admin-only', async () => {
    const app = makeApp();
    expect((await request(app).get('/api/bakers')).status).toBe(401); // no token
    expect((await request(app).get('/api/bakers').set('Authorization', 'Bearer bak')).status).toBe(
      403,
    ); // a baker
    const res = await request(app).get('/api/bakers').set('Authorization', 'Bearer adm');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('verified');
  });

  it('an admin can verify a baker; the verified flag flips', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/bakers/user-bakU/verification')
      .set('Authorization', 'Bearer adm')
      .send({ verified: true });
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    // and back again
    const off = await request(app)
      .post('/api/bakers/user-bakU/verification')
      .set('Authorization', 'Bearer adm')
      .send({ verified: false });
    expect(off.body.verified).toBe(false);
  });

  it('verifying is admin-only and validated', async () => {
    const app = makeApp();
    // a baker cannot verify anyone
    expect(
      (
        await request(app)
          .post('/api/bakers/user-bakU/verification')
          .set('Authorization', 'Bearer bak')
          .send({ verified: true })
      ).status,
    ).toBe(403);
    // missing flag → 400
    expect(
      (
        await request(app)
          .post('/api/bakers/user-bakU/verification')
          .set('Authorization', 'Bearer adm')
          .send({})
      ).status,
    ).toBe(400);
    // unknown baker → 404
    expect(
      (
        await request(app)
          .post('/api/bakers/nobody/verification')
          .set('Authorization', 'Bearer adm')
          .send({ verified: true })
      ).status,
    ).toBe(404);
  });
});

describe('stats API', () => {
  it('GET /api/stats is admin-only', async () => {
    const app = makeApp();
    expect((await request(app).get('/api/stats')).status).toBe(401);
    expect((await request(app).get('/api/stats').set('Authorization', 'Bearer bak')).status).toBe(
      403,
    );
  });

  it('counts requests by status and bakers by verification', async () => {
    const app = makeApp();
    await request(app).post('/api/requests').set('Authorization', 'Bearer req').send(validDraft);
    await request(app).post('/api/requests').set('Authorization', 'Bearer req').send(validDraft);
    const res = await request(app).get('/api/stats').set('Authorization', 'Bearer adm');
    expect(res.status).toBe(200);
    expect(res.body.requests.total).toBe(2);
    expect(res.body.requests.open).toBe(2);
    expect(res.body.requests.received).toBe(0);
    expect(res.body.bakers.total).toBe(3); // fake store seeds 3 bakers
    expect(res.body.bakers.verified).toBe(2); // two are verified
  });
});

describe('attention API', () => {
  const makeRequest = (over: Partial<CakeRequest>): CakeRequest => ({
    id: 'x',
    recipient: 'Maya',
    occasion: 'birthday',
    neededBy: '2999-01-01',
    dietary: '',
    location: 'Haifa',
    createdAt: Date.now(),
    ownerId: 'user-req',
    status: 'open',
    reservedBy: null,
    reservedContact: null,
    reservedByUserId: null,
    reservedUntil: null,
    reservedAt: null,
    committedAt: null,
    deliveredAt: null,
    receivedAt: null,
    hasPhoto: false,
    ...over,
  });

  it('GET /api/attention is admin-only', async () => {
    const app = makeApp();
    expect((await request(app).get('/api/attention')).status).toBe(401);
    expect(
      (await request(app).get('/api/attention').set('Authorization', 'Bearer bak')).status,
    ).toBe(403);
  });

  it('lists stuck requests with a reason and the requester’s contact', async () => {
    const overdue = makeRequest({ id: 'a1', neededBy: '2020-01-01', ownerId: 'user-req' });
    const fresh = makeRequest({ id: 'a2' }); // future date, just created → fine
    const app = createApp(
      makeFakeStore([overdue, fresh]),
      makeFakeTranslator(),
      makeFakeAuthenticator(),
      makeFakeProfilesStore(),
    );
    const res = await request(app).get('/api/attention').set('Authorization', 'Bearer adm');
    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((x) => x.id);
    expect(ids).toContain('a1');
    expect(ids).not.toContain('a2');
    const item = (res.body as { id: string; reason: string; ownerContact: string }[]).find(
      (x) => x.id === 'a1',
    )!;
    expect(item.reason).toBe('overdue');
    expect(item.ownerContact).toBe('rae@example.com');
  });
});

describe('translate API', () => {
  it('POST /api/translate returns the translated text', async () => {
    const res = await request(makeApp()).post('/api/translate').send({ text: 'hello', to: 'he' });
    expect(res.status).toBe(200);
    expect(res.body.translated).toBe('[he] hello');
  });

  it('POST /api/translate with missing text returns 400', async () => {
    const res = await request(makeApp()).post('/api/translate').send({ text: '', to: 'he' });
    expect(res.status).toBe(400);
  });

  it('POST /api/translate returns 500 when the translator throws', async () => {
    const throwing: Translator = {
      async translate() {
        throw new Error('boom');
      },
    };
    const res = await request(createApp(makeFakeStore(), throwing, makeFakeAuthenticator(), makeFakeProfilesStore()))
      .post('/api/translate')
      .send({ text: 'hello', to: 'he' });
    expect(res.status).toBe(500);
  });
});
