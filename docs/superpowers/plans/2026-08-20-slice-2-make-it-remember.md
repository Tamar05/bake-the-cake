# Slice 2: Make It Remember (persistence) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cake requests survive a page refresh by being saved in a Supabase (Postgres) database, reached through a small Express server; the frontend loads and saves requests via that server instead of holding them in browser memory.

**Architecture:** `browser (React) → server (Express) → Supabase`. The server is a new `server/` folder and is the only thing holding the database's secret key (in a git-ignored `server/.env`). Server logic is split so the HTTP endpoints depend on a small `RequestsStore` interface — a real Supabase-backed store in production, an in-memory fake store in tests (so tests never need real Supabase). Frontend gets a `requestsApi` helper (mirroring pocket-pt's `workoutLog.ts`).

**Tech Stack:** Frontend unchanged (React 18 + Vite 5 + Vitest 2). Server: Express 4 + `@supabase/supabase-js` + cors + dotenv, run in dev with `tsx` (no compile step this slice), tested with Vitest 2 + supertest. Mirrors the `pocket-pt` server.

## Global Constraints

- **Mirror pocket-pt's server pattern:** separate `server/` folder with its own `package.json`; Express + cors + dotenv + `@supabase/supabase-js`; dev via `tsx watch`; tests via vitest + supertest.
- **Server runs via `tsx` in dev — no `tsc` build/deploy this slice.** Deployment (Render/Cloudflare) is a later concern. Type-checking is done with `tsc --noEmit`.
- **Secrets never committed:** `server/.env` and the frontend `.env` are git-ignored. Only `.env.example` files (with blank/placeholder values) are committed.
- **Frontend reaches the server via `import.meta.env.VITE_API_BASE_URL`** (default `http://localhost:3001`). Requires a `src/vite-env.d.ts` referencing `vite/client` so `import.meta.env` is typed.
- **Database column naming is snake_case** (`needed_by`, `created_at`); the app uses camelCase (`neededBy`, `createdAt`). A server-side mapper converts between them.
- **English and Hebrew dictionaries keep identical keys** (guarded by `src/i18n/i18n.test.ts`). New keys go into both `en.ts` and `he.ts`.
- **Test config:** frontend Vitest runs `src/**/*.test.ts` in `node` env; server Vitest runs in `node` env with globals. React components verified by type-check, not unit tests.
- **Build on `master`.** Commits land on `master`; honor the standing rule to ask before each commit.
- **Scope:** persistence only. NO accounts/auth, NO baker features, NO edit/delete, NO deployment, NO translation of typed content.

---

### Task 1: Supabase project + `cake_requests` table (guided setup — no repo code)

This is a human-driven setup task. Deliverable: a Supabase project exists, the `cake_requests` table exists, and the user has their **Project URL** and **service_role key** copied somewhere ready to paste in Task 2. Nothing is committed.

**Files:** none (external setup in the Supabase web dashboard).

- [ ] **Step 1: Create (or pick) a Supabase project**

Guide the user: go to https://supabase.com → sign in → **New project** → name it `bake-the-cake`, choose a region near them, set a database password (Supabase generates one; they don't need it for this slice) → **Create new project**. Wait ~1–2 minutes for it to finish provisioning.

- [ ] **Step 2: Create the table via the SQL editor**

Guide the user: in the project, open **SQL Editor** (left sidebar) → **New query** → paste this exactly → click **Run**:

```sql
create table if not exists cake_requests (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  occasion text not null,
  needed_by text not null,
  dietary text not null default '',
  location text not null,
  created_at timestamptz not null default now()
);

alter table cake_requests enable row level security;
```

Expected: "Success. No rows returned." (Row Level Security is turned on with no public policies, so only our server — which uses the secret service key that bypasses RLS — can read/write the table.)

- [ ] **Step 3: Confirm the table exists**

Guide the user: open **Table Editor** (left sidebar) → confirm `cake_requests` appears with the seven columns. It will be empty — that's correct.

- [ ] **Step 4: Copy the two connection values**

Guide the user: open **Project Settings** (gear icon) → **API**. Copy two things into a temporary note (they go into `server/.env` in Task 2):
- **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
- **service_role** key, under "Project API keys" → reveal the `service_role` **secret** (NOT the `anon` key). This is a secret — it will only ever live in the git-ignored `server/.env`.

No commit for this task (nothing changed in the repo).

---

### Task 2: Server scaffold that boots with a health check

Create the `server/` folder as a runnable Express app with a health-check route, its config, and the secret `.env`. Deliverable: the server starts and `GET /api/health` returns `{ "ok": true }`.

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/vitest.config.ts`
- Create: `server/.env.example`
- Create: `server/.env` (git-ignored; user pastes their Supabase values)
- Create: `server/src/types.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Modify: `.gitignore` (root) — ignore `.env` files

**Interfaces:**
- Produces: `createApp(): express.Express` (health route only for now — extended in Task 4); a running server on `PORT` (default 3001); `RequestDraft` / `CakeRequest` types for the server.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "bake-the-cake-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.112.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `server/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `server/.env.example`** (committed; placeholders only)

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=3001
```

- [ ] **Step 5: Create `server/.env`** (git-ignored; real values)

Guide the user to paste their Task 1 values. The file contents:

```
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
PORT=3001
```

(Replace the two placeholders with the real Project URL and service_role key from Task 1.)

- [ ] **Step 6: Add `.env` to the root `.gitignore`**

The root `.gitignore` currently contains `node_modules` and `dist`. Add a line so no `.env` file is ever committed (this pattern matches `server/.env` and a frontend `.env` alike):

```
.env
```

- [ ] **Step 7: Create `server/src/types.ts`**

```ts
// The fields a person submits (same shape as the frontend's RequestDraft).
export type RequestDraft = {
  recipient: string;
  occasion: string;
  neededBy: string;
  dietary: string;
  location: string;
};

// A saved request: the draft plus a database id and a timestamp (ms since 1970).
export type CakeRequest = RequestDraft & {
  id: string;
  createdAt: number;
};
```

- [ ] **Step 8: Create `server/src/app.ts`** (health route only for now)

```ts
import express from 'express';
import cors from 'cors';

// Builds the Express app. Task 4 extends this to take a store and add the
// /api/requests endpoints.
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 9: Create `server/src/index.ts`**

```ts
import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`Bake the Cake server listening on http://localhost:${port}`);
});
```

- [ ] **Step 10: Install the server's dependencies**

Run (from the `server/` folder): `npm install`
Expected: creates `server/node_modules` and `server/package-lock.json` with no errors.

- [ ] **Step 11: Verify the server boots and the health route answers**

Start it (from `server/`): `npm run dev` — expect the log `Bake the Cake server listening on http://localhost:3001`.
In a second terminal, run: `curl http://localhost:3001/api/health`
Expected: `{"ok":true}`. Stop the server with Ctrl+C.

- [ ] **Step 12: Commit** (after user approval)

```bash
git add .gitignore server/package.json server/package-lock.json server/tsconfig.json server/vitest.config.ts server/.env.example server/src/
git commit -m "feat(server): scaffold Express server with health check"
```

(Note: `server/.env` and `server/node_modules` are git-ignored and must NOT appear in the commit — confirm with `git status` before committing.)

---

### Task 3: Data layer — request mapper + store (Supabase-backed) — TDD the mapper

The pieces that talk to the database: a pure mapper (snake_case row → camelCase request) written test-first, and a `RequestsStore` (interface + Supabase implementation). Deliverable: passing mapper test; type-check passes.

**Files:**
- Create: `server/src/requestMapper.ts`
- Test: `server/src/requestMapper.test.ts`
- Create: `server/src/requestsStore.ts`

**Interfaces:**
- Consumes: `CakeRequest`, `RequestDraft` from `server/src/types.ts`.
- Produces:
  - `type CakeRequestRow` (snake_case DB row) and `rowToRequest(row): CakeRequest`.
  - `type RequestsStore = { listRequests(): Promise<CakeRequest[]>; addRequest(draft: RequestDraft): Promise<CakeRequest> }`.
  - `createSupabaseStore(): RequestsStore` — reads `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from env, talks to the `cake_requests` table.

- [ ] **Step 1: Write the failing mapper test** `server/src/requestMapper.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { rowToRequest } from './requestMapper';

describe('rowToRequest', () => {
  it('maps snake_case columns to the camelCase request shape', () => {
    const row = {
      id: 'abc',
      recipient: 'Maya',
      occasion: '8th birthday',
      needed_by: '2026-09-01',
      dietary: 'nut-free',
      location: 'Haifa',
      created_at: '2026-08-20T10:00:00.000Z',
    };
    expect(rowToRequest(row)).toEqual({
      id: 'abc',
      recipient: 'Maya',
      occasion: '8th birthday',
      neededBy: '2026-09-01',
      dietary: 'nut-free',
      location: 'Haifa',
      createdAt: Date.parse('2026-08-20T10:00:00.000Z'),
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `server/`): `npm test`
Expected: FAIL — cannot find `./requestMapper`.

- [ ] **Step 3: Create `server/src/requestMapper.ts`**

```ts
import type { CakeRequest } from './types';

// A row exactly as stored in the cake_requests table (snake_case columns).
export type CakeRequestRow = {
  id: string;
  recipient: string;
  occasion: string;
  needed_by: string;
  dietary: string;
  location: string;
  created_at: string; // ISO timestamp from Postgres
};

// Turns a database row into the camelCase shape the app uses.
export function rowToRequest(row: CakeRequestRow): CakeRequest {
  return {
    id: row.id,
    recipient: row.recipient,
    occasion: row.occasion,
    neededBy: row.needed_by,
    dietary: row.dietary,
    location: row.location,
    createdAt: new Date(row.created_at).getTime(),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `server/`): `npm test`
Expected: PASS — the `rowToRequest` test is green.

- [ ] **Step 5: Create `server/src/requestsStore.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type { CakeRequest, RequestDraft } from './types';
import { rowToRequest, type CakeRequestRow } from './requestMapper';

// What the HTTP endpoints need from a store. A real Supabase-backed store is
// used in production; tests inject an in-memory fake with the same shape.
export type RequestsStore = {
  listRequests(): Promise<CakeRequest[]>;
  addRequest(draft: RequestDraft): Promise<CakeRequest>;
};

// Builds a store backed by the Supabase cake_requests table.
export function createSupabaseStore(): RequestsStore {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
  }
  const supabase = createClient(url, key);

  return {
    async listRequests(): Promise<CakeRequest[]> {
      const { data, error } = await supabase
        .from('cake_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as CakeRequestRow[]).map(rowToRequest);
    },

    async addRequest(draft: RequestDraft): Promise<CakeRequest> {
      const { data, error } = await supabase
        .from('cake_requests')
        .insert({
          recipient: draft.recipient,
          occasion: draft.occasion,
          needed_by: draft.neededBy,
          dietary: draft.dietary,
          location: draft.location,
        })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return rowToRequest(data as CakeRequestRow);
    },
  };
}
```

- [ ] **Step 6: Type-check the server**

Run (from `server/`): `npm run typecheck`
Expected: `tsc --noEmit` passes with no errors.

- [ ] **Step 7: Commit** (after user approval)

```bash
git add server/src/requestMapper.ts server/src/requestMapper.test.ts server/src/requestsStore.ts
git commit -m "feat(server): add request mapper and Supabase-backed store"
```

---

### Task 4: The `/api/requests` endpoints (GET + POST) with tests

Wire the store into the app and expose the two endpoints; test them with supertest against an in-memory fake store. Deliverable: passing endpoint tests, and a real end-to-end check that a POST creates a row in Supabase.

**Files:**
- Modify: `server/src/app.ts` (accept a store; add GET + POST `/api/requests`)
- Modify: `server/src/index.ts` (create the Supabase store, pass it to `createApp`)
- Test: `server/src/app.test.ts`

**Interfaces:**
- Consumes: `RequestsStore` from `server/src/requestsStore.ts`; `RequestDraft` from `server/src/types.ts`.
- Produces: `createApp(store: RequestsStore): express.Express` with:
  - `GET /api/requests` → `200` + array of requests (newest first).
  - `POST /api/requests` → `201` + saved request; `400` if a required field (recipient/occasion/neededBy/location) is missing; `500` if the store throws.
  - `GET /api/health` → unchanged.

- [ ] **Step 1: Write the failing endpoint tests** `server/src/app.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import type { RequestsStore } from './requestsStore';
import type { CakeRequest, RequestDraft } from './types';

// An in-memory stand-in for the Supabase store, so these tests need no database.
function makeFakeStore(): RequestsStore {
  const items: CakeRequest[] = [];
  return {
    async listRequests() {
      return [...items].sort((a, b) => b.createdAt - a.createdAt);
    },
    async addRequest(draft: RequestDraft) {
      const saved: CakeRequest = {
        ...draft,
        id: `id-${items.length + 1}`,
        createdAt: Date.now() + items.length,
      };
      items.push(saved);
      return saved;
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
    const res = await request(createApp(makeFakeStore())).get('/api/requests');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/requests saves and returns the request with an id', async () => {
    const res = await request(createApp(makeFakeStore())).post('/api/requests').send(validDraft);
    expect(res.status).toBe(201);
    expect(res.body.recipient).toBe('Maya');
    expect(res.body.id).toBeTruthy();
  });

  it('a saved request then appears in the list', async () => {
    const app = createApp(makeFakeStore());
    await request(app).post('/api/requests').send(validDraft);
    const res = await request(app).get('/api/requests');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].recipient).toBe('Maya');
  });

  it('POST with a missing required field returns 400', async () => {
    const res = await request(createApp(makeFakeStore()))
      .post('/api/requests')
      .send({ recipient: '', occasion: '', neededBy: '', dietary: '', location: '' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npm test`
Expected: FAIL — `createApp` currently takes no store and has no `/api/requests` routes.

- [ ] **Step 3: Update `server/src/app.ts`** to take a store and add the endpoints

```ts
import express from 'express';
import cors from 'cors';
import type { RequestsStore } from './requestsStore';
import type { RequestDraft } from './types';

// The required fields a new request must include.
function isMissingRequired(draft: Partial<RequestDraft>): boolean {
  return !draft.recipient || !draft.occasion || !draft.neededBy || !draft.location;
}

// Builds the Express app around a store (real Supabase store in production,
// an in-memory fake in tests).
export function createApp(store: RequestsStore) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/requests', async (_req, res) => {
    try {
      const requests = await store.listRequests();
      res.json(requests);
    } catch {
      res.status(500).json({ error: 'Could not load requests' });
    }
  });

  app.post('/api/requests', async (req, res) => {
    const draft = (req.body ?? {}) as Partial<RequestDraft>;
    if (isMissingRequired(draft)) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    try {
      const saved = await store.addRequest({
        recipient: draft.recipient!,
        occasion: draft.occasion!,
        neededBy: draft.neededBy!,
        dietary: draft.dietary ?? '',
        location: draft.location!,
      });
      res.status(201).json(saved);
    } catch {
      res.status(500).json({ error: 'Could not save request' });
    }
  });

  return app;
}
```

- [ ] **Step 4: Update `server/src/index.ts`** to create and pass the Supabase store

```ts
import 'dotenv/config';
import { createApp } from './app';
import { createSupabaseStore } from './requestsStore';

const port = Number(process.env.PORT ?? 3001);
const store = createSupabaseStore();
const app = createApp(store);

app.listen(port, () => {
  console.log(`Bake the Cake server listening on http://localhost:${port}`);
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `server/`): `npm test`
Expected: PASS — all four `requests API` tests plus the mapper test are green.

- [ ] **Step 6: Type-check the server**

Run (from `server/`): `npm run typecheck`
Expected: passes with no errors.

- [ ] **Step 7: Real end-to-end check against Supabase** (human step)

Start the server (from `server/`): `npm run dev`. In a second terminal:

```bash
curl -X POST http://localhost:3001/api/requests \
  -H "Content-Type: application/json" \
  -d '{"recipient":"Test","occasion":"trying it out","neededBy":"2026-09-01","dietary":"","location":"Haifa"}'
```

Expected: a JSON response with an `id` and the fields. Then `curl http://localhost:3001/api/requests` returns an array containing it, and the row is visible in Supabase's **Table Editor** → `cake_requests`. Stop the server with Ctrl+C.

- [ ] **Step 8: Commit** (after user approval)

```bash
git add server/src/app.ts server/src/index.ts server/src/app.test.ts
git commit -m "feat(server): add GET/POST /api/requests endpoints"
```

---

### Task 5: Frontend API helper + environment config — TDD

The frontend's bridge to the server: `loadRequests` / `saveRequest`, written test-first with `fetch` mocked (mirroring pocket-pt's `workoutLog.test.ts`), plus the env files and the Vite type reference. Deliverable: passing API tests; frontend build passes.

**Files:**
- Create: `src/lib/requestsApi.ts`
- Test: `src/lib/requestsApi.test.ts`
- Create: `src/vite-env.d.ts`
- Create: `.env` (git-ignored)
- Create: `.env.example` (committed)

**Interfaces:**
- Consumes: `CakeRequest`, `RequestDraft` from `src/types.ts`.
- Produces:
  - `loadRequests(): Promise<CakeRequest[]>` — GET `${VITE_API_BASE_URL}/api/requests`.
  - `saveRequest(draft: RequestDraft): Promise<CakeRequest>` — POST the draft as JSON, returns the saved request.

- [ ] **Step 1: Write the failing test** `src/lib/requestsApi.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRequests, saveRequest } from './requestsApi';
import type { RequestDraft } from '../types';

const draft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
};

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://server.example');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('requestsApi', () => {
  it('loadRequests GETs the server and returns the parsed array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);
    const result = await loadRequests();
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests');
    expect(result).toEqual([]);
  });

  it('saveRequest POSTs the draft as JSON and returns the saved request', async () => {
    const saved = { ...draft, id: 'x', createdAt: 1 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => saved });
    vi.stubGlobal('fetch', fetchMock);
    const result = await saveRequest(draft);
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    expect(result).toEqual(saved);
  });

  it('loadRequests throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadRequests()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from project root): `npm test`
Expected: FAIL — cannot find `./requestsApi`.

- [ ] **Step 3: Create `src/vite-env.d.ts`** (so `import.meta.env` is typed)

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Create `src/lib/requestsApi.ts`**

```ts
import type { CakeRequest, RequestDraft } from '../types';

// The server's address, set per environment in the frontend .env file.
function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// Loads every saved request from the server, newest first.
export async function loadRequests(): Promise<CakeRequest[]> {
  const res = await fetch(`${apiBase()}/api/requests`);
  if (!res.ok) throw new Error(`Could not load requests (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest[];
}

// Saves one new request and returns it with its database id + timestamp.
export async function saveRequest(draft: RequestDraft): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error(`Could not save request (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}
```

- [ ] **Step 5: Create the frontend `.env`** (git-ignored)

```
VITE_API_BASE_URL=http://localhost:3001
```

- [ ] **Step 6: Create the frontend `.env.example`** (committed)

```
VITE_API_BASE_URL=http://localhost:3001
```

- [ ] **Step 7: Run the tests to verify they pass**

Run (from project root): `npm test`
Expected: PASS — the three `requestsApi` tests plus all existing tests are green.

- [ ] **Step 8: Type-check / build the frontend**

Run (from project root): `npm run build`
Expected: passes with no type errors.

- [ ] **Step 9: Commit** (after user approval)

```bash
git add src/lib/requestsApi.ts src/lib/requestsApi.test.ts src/vite-env.d.ts .env.example
git commit -m "feat: add frontend requests API helper and env config"
```

(Note: the frontend `.env` is git-ignored and must NOT be committed — only `.env.example`. Confirm with `git status`.)

---

### Task 6: Wire the frontend to the server (load on startup, save on submit)

Replace the in-memory list with server-backed loading/saving, including loading and error states, and remove the now-unused `createRequest`. Deliverable: the full Slice 2 experience — requests survive a refresh.

**Files:**
- Modify: `src/i18n/types.ts` (add `list.loading`, `list.loadError`)
- Modify: `src/i18n/en.ts` (add the two strings)
- Modify: `src/i18n/he.ts` (add the two strings)
- Modify (replace): `src/App.tsx`
- Modify: `src/lib/requests.ts` (remove `createRequest` + `makeId`; keep `findMissingFields`)
- Modify: `src/lib/requests.test.ts` (remove the `createRequest` describe block; keep `findMissingFields` tests)
- Modify (append): `src/styles/base.css` (style the loading/error messages)

**Interfaces:**
- Consumes: `loadRequests`, `saveRequest` from `src/lib/requestsApi.ts`; existing components and i18n.
- Produces: the assembled Slice 2 screen. `src/lib/requests.ts` now exports only `findMissingFields`.

- [ ] **Step 1: Add `loading` and `loadError` to the `Dictionary` list section** in `src/i18n/types.ts`

Inside the `list: { ... }` block, add:

```ts
    loading: string; // shown while requests are being fetched
    loadError: string; // shown when the server can't be reached
```

- [ ] **Step 2: Add the English strings** in `src/i18n/en.ts` (inside the `list` object)

```ts
    loading: 'Loading requests…',
    loadError: 'Could not reach the server. Make sure the backend is running, then refresh.',
```

- [ ] **Step 3: Add the Hebrew strings** in `src/i18n/he.ts` (inside the `list` object)

```ts
    loading: 'טוען בקשות…',
    loadError: 'לא ניתן להתחבר לשרת. ודאו שהשרת פועל ורעננו את הדף.',
```

- [ ] **Step 4: Replace `src/App.tsx`**

```tsx
import { useState, useEffect } from 'react';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import LanguageToggle from './components/LanguageToggle';
import { dictionaries, loadLanguage, saveLanguage, type Language } from './i18n/language';
import { loadRequests, saveRequest } from './lib/requestsApi';
import type { CakeRequest, RequestDraft } from './types';

type Status = 'loading' | 'ready' | 'error';

export default function App() {
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [requests, setRequests] = useState<CakeRequest[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const t = dictionaries[language];

  // Keep the page's reading direction and lang in step with the language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  }, [language]);

  // Load the saved requests from the server once, on startup.
  useEffect(() => {
    loadRequests()
      .then((list) => {
        setRequests(list);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  function handleLanguageChange(next: Language) {
    setLanguage(next);
    saveLanguage(next);
  }

  async function handleAdd(draft: RequestDraft) {
    try {
      const saved = await saveRequest(draft);
      setRequests((prev) => [saved, ...prev]); // newest first
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <LanguageToggle t={t} language={language} onChange={handleLanguageChange} />
        <h1>{t.appTitle}</h1>
        <p>{t.tagline}</p>
      </header>
      <RequestForm t={t} onAdd={handleAdd} />
      {status === 'loading' && <p className="list-status">{t.list.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.list.loadError}</p>}
      {status === 'ready' && <RequestList t={t} requests={requests} />}
    </main>
  );
}
```

- [ ] **Step 5: Remove `createRequest` (and `makeId`) from `src/lib/requests.ts`**, keeping `findMissingFields`

The whole file becomes exactly:

```ts
import type { RequestDraft } from '../types';

// dietary is intentionally NOT in this list — it is optional.
const REQUIRED_FIELDS: Array<keyof RequestDraft> = [
  'recipient',
  'occasion',
  'neededBy',
  'location',
];

// Returns the required fields that are still blank (ignoring surrounding spaces).
export function findMissingFields(draft: RequestDraft): Array<keyof RequestDraft> {
  return REQUIRED_FIELDS.filter((field) => draft[field].trim() === '');
}
```

- [ ] **Step 6: Remove the `createRequest` tests from `src/lib/requests.test.ts`**, keeping the `findMissingFields` tests

The whole file becomes exactly:

```ts
import { describe, it, expect } from 'vitest';
import { findMissingFields } from './requests';
import type { RequestDraft } from '../types';

const fullDraft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday, dinosaurs',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
};

describe('findMissingFields', () => {
  it('returns an empty array when all required fields are filled', () => {
    expect(findMissingFields(fullDraft)).toEqual([]);
  });

  it('lists the required fields that are blank or only spaces', () => {
    const draft: RequestDraft = { ...fullDraft, recipient: '', location: '   ' };
    expect(findMissingFields(draft).sort()).toEqual(['location', 'recipient']);
  });

  it('does not require the dietary field', () => {
    const draft: RequestDraft = { ...fullDraft, dietary: '' };
    expect(findMissingFields(draft)).toEqual([]);
  });
});
```

- [ ] **Step 7: Append status styles to `src/styles/base.css`**

```css
.list-status {
  text-align: center;
  color: #8a6d6d;
  padding: 1rem;
}

.list-error {
  color: #c0392b;
  font-weight: 600;
}
```

- [ ] **Step 8: Type-check / build and run all tests**

Run (from project root): `npm run build`
Expected: passes with no type errors (note `createRequest` is gone and nothing imports it).

Run (from project root): `npm test`
Expected: PASS — i18n key-parity, language, `findMissingFields`, and `requestsApi` tests all green.

- [ ] **Step 9: Full manual end-to-end check** (human step)

Run BOTH servers (two terminals):
- Terminal A (from `server/`): `npm run dev`
- Terminal B (from project root): `npm run dev` → open the printed URL.

Confirm:
1. The page loads and shows the (empty or existing) request list — not the error message.
2. Submit a request → it appears at the top of the list.
3. **Refresh the page → the request is still there** (this is the whole point of Slice 2).
4. The new row is visible in Supabase's Table Editor → `cake_requests`.
5. Switch to עברית → labels translate, the persisted requests still show; the loading/error messages are Hebrew if they appear.
6. Stop Terminal A's server, refresh the page → the friendly "could not reach the server" message shows (proving the error state works). Restart it and refresh → back to normal.

Stop both servers with Ctrl+C.

- [ ] **Step 10: Commit** (after user approval)

```bash
git add src/App.tsx src/i18n/types.ts src/i18n/en.ts src/i18n/he.ts src/lib/requests.ts src/lib/requests.test.ts src/styles/base.css
git commit -m "feat: load and save requests via the server (persistence)"
```

---

## Notes for whoever runs this plan

- **Two programs run now.** The backend (`server/`, port 3001) and the frontend (root, port 5173) must both be running for the app to work. If the page shows "could not reach the server," the backend isn't running.
- **Secrets:** `server/.env` and the frontend `.env` are git-ignored; never commit them. `.env.example` files document what's needed.
- **Tests never touch real Supabase** — the server tests use an in-memory fake store; the frontend tests mock `fetch`. The only checks that use real Supabase are the human end-to-end steps.
- **This unlocks the future Translate button**, which will add an AI call inside this same server.
- **The user is new to coding.** Explain each task in plain English, keep steps small, guide the Supabase clicks, and pause for approval before every commit.
```
