import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { ALREADY_RESERVED, NOT_RESERVER, type RequestsStore } from './requestsStore';
import type { Authenticator, AuthedProfile } from './auth';
import type { Translator } from './translator';
import { RESERVATION_MS, type CakeRequest, type RequestDraft } from './types';

// An in-memory stand-in for the Supabase store, so these tests need no database.
function makeFakeStore(): RequestsStore {
  const items: CakeRequest[] = [];
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
      };
      items.push(saved);
      return saved;
    },
    async reserveRequest(id, userId, name, contact) {
      const item = find(id);
      if (!item) throw new Error('not found');
      if (item.status === 'reserved') throw new Error(ALREADY_RESERVED);
      Object.assign(item, {
        status: 'reserved',
        reservedBy: name,
        reservedContact: contact,
        reservedByUserId: userId,
        reservedUntil: Date.now() + RESERVATION_MS,
      });
      return item;
    },
    async releaseRequest(id, userId, isAdmin) {
      const item = find(id);
      if (!item) throw new Error('not found');
      if (!isAdmin && item.reservedByUserId !== userId) throw new Error(NOT_RESERVER);
      Object.assign(item, {
        status: 'open',
        reservedBy: null,
        reservedContact: null,
        reservedByUserId: null,
        reservedUntil: null,
      });
      return item;
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
  req: { id: 'user-req', displayName: 'Rae', role: 'requester', contact: null },
  bak: { id: 'user-bak', displayName: 'Baz', role: 'baker', contact: 'baz@example.com' },
  bak2: { id: 'user-bak2', displayName: 'Bex', role: 'baker', contact: 'bex@example.com' },
  adm: { id: 'user-adm', displayName: 'Ada', role: 'admin', contact: null },
};
function makeFakeAuthenticator(): Authenticator {
  return {
    async verify(token: string) {
      return PROFILES[token] ?? null;
    },
  };
}

function makeApp() {
  return createApp(makeFakeStore(), makeFakeTranslator(), makeFakeAuthenticator());
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
    const res = await request(createApp(makeFakeStore(), throwing, makeFakeAuthenticator()))
      .post('/api/translate')
      .send({ text: 'hello', to: 'he' });
    expect(res.status).toBe(500);
  });
});
