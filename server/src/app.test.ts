import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { ALREADY_RESERVED, type RequestsStore } from './requestsStore';
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
    async addRequest(draft: RequestDraft) {
      const saved: CakeRequest = {
        ...draft,
        id: `id-${items.length + 1}`,
        createdAt: Date.now() + items.length,
        status: 'open',
        reservedBy: null,
        reservedContact: null,
        reservedUntil: null,
      };
      items.push(saved);
      return saved;
    },
    async reserveRequest(id, name, contact) {
      const item = find(id);
      if (!item) throw new Error('not found');
      if (item.status === 'reserved') throw new Error(ALREADY_RESERVED);
      Object.assign(item, {
        status: 'reserved',
        reservedBy: name,
        reservedContact: contact,
        reservedUntil: Date.now() + RESERVATION_MS,
      });
      return item;
    },
    async releaseRequest(id) {
      const item = find(id);
      if (!item) throw new Error('not found');
      Object.assign(item, {
        status: 'open',
        reservedBy: null,
        reservedContact: null,
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

const validDraft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
};

describe('requests API', () => {
  it('GET /api/requests starts empty', async () => {
    const res = await request(createApp(makeFakeStore(), makeFakeTranslator())).get('/api/requests');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/requests saves and returns the request with an id', async () => {
    const res = await request(createApp(makeFakeStore(), makeFakeTranslator())).post('/api/requests').send(validDraft);
    expect(res.status).toBe(201);
    expect(res.body.recipient).toBe('Maya');
    expect(res.body.id).toBeTruthy();
  });

  it('a saved request then appears in the list', async () => {
    const app = createApp(makeFakeStore(), makeFakeTranslator());
    await request(app).post('/api/requests').send(validDraft);
    const res = await request(app).get('/api/requests');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].recipient).toBe('Maya');
  });

  it('POST with a missing required field returns 400', async () => {
    const res = await request(createApp(makeFakeStore(), makeFakeTranslator()))
      .post('/api/requests')
      .send({ recipient: '', occasion: '', neededBy: '', dietary: '', location: '' });
    expect(res.status).toBe(400);
  });
});

describe('reserve API', () => {
  async function addOne(app: ReturnType<typeof createApp>) {
    const res = await request(app).post('/api/requests').send(validDraft);
    return res.body.id as string;
  }

  it('reserving flips a request to reserved with the baker details', async () => {
    const app = createApp(makeFakeStore(), makeFakeTranslator());
    const id = await addOne(app);
    const res = await request(app)
      .post(`/api/requests/${id}/reserve`)
      .send({ name: 'Dana', contact: 'dana@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('reserved');
    expect(res.body.reservedBy).toBe('Dana');
    expect(res.body.reservedContact).toBe('dana@example.com');
    expect(res.body.reservedUntil).toBeGreaterThan(Date.now());
  });

  it('reserving without a name or contact returns 400', async () => {
    const app = createApp(makeFakeStore(), makeFakeTranslator());
    const id = await addOne(app);
    const res = await request(app).post(`/api/requests/${id}/reserve`).send({ name: 'Dana' });
    expect(res.status).toBe(400);
  });

  it('reserving an already-reserved request returns 409', async () => {
    const app = createApp(makeFakeStore(), makeFakeTranslator());
    const id = await addOne(app);
    await request(app).post(`/api/requests/${id}/reserve`).send({ name: 'Dana', contact: 'd@e.com' });
    const res = await request(app)
      .post(`/api/requests/${id}/reserve`)
      .send({ name: 'Noa', contact: 'n@e.com' });
    expect(res.status).toBe(409);
  });

  it('releasing a reserved request returns it to open', async () => {
    const app = createApp(makeFakeStore(), makeFakeTranslator());
    const id = await addOne(app);
    await request(app).post(`/api/requests/${id}/reserve`).send({ name: 'Dana', contact: 'd@e.com' });
    const res = await request(app).post(`/api/requests/${id}/release`).send();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('open');
    expect(res.body.reservedBy).toBeNull();
  });
});

describe('translate API', () => {
  it('POST /api/translate returns the translated text', async () => {
    const res = await request(createApp(makeFakeStore(), makeFakeTranslator()))
      .post('/api/translate')
      .send({ text: 'hello', to: 'he' });
    expect(res.status).toBe(200);
    expect(res.body.translated).toBe('[he] hello');
  });

  it('POST /api/translate with missing text returns 400', async () => {
    const res = await request(createApp(makeFakeStore(), makeFakeTranslator()))
      .post('/api/translate')
      .send({ text: '', to: 'he' });
    expect(res.status).toBe(400);
  });

  it('POST /api/translate returns 500 when the translator throws', async () => {
    const throwing: Translator = {
      async translate() {
        throw new Error('boom');
      },
    };
    const res = await request(createApp(makeFakeStore(), throwing))
      .post('/api/translate')
      .send({ text: 'hello', to: 'he' });
    expect(res.status).toBe(500);
  });
});
