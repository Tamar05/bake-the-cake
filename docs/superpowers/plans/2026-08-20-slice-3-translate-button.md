# Slice 3: Translate Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand **Translate** button to each request card that translates the typed-in text into the language the page is currently showing (toggling back to the original on a second click), using the free, no-key MyMemory service through our own server.

**Architecture:** `card → POST /api/translate (our server) → MyMemory → back to the card`. The server route depends on a small `Translator` interface — a real MyMemory-backed translator in production, an in-memory fake in tests (so tests never hit the network). The frontend gets a `translateText` helper mirroring `requestsApi.ts`, and each card becomes its own `RequestCard` component holding its translated/original toggle state.

**Tech Stack:** Unchanged. Server: Express 4 + global `fetch` (Node 18+) for the MyMemory call. Frontend: React 18 + Vite 5. Tests: Vitest 2 + supertest (server), Vitest 2 with mocked `fetch` (frontend).

## Global Constraints

- **Free, no-key engine:** MyMemory API, `GET https://api.mymemory.translated.net/get?q=<text>&langpair=<from>|<to>`; translated text is at `responseData.translatedText`. No API key, no secret, nothing new in `.env`.
- **Route through our server** (`POST /api/translate`) even though no key is needed — keeps the frontend simple and the engine swappable.
- **Translate direction:** into the currently-shown language, from the other. `to === 'he'` ⇒ `from = 'en'`; `to === 'en'` ⇒ `from = 'he'`.
- **Fields translated:** `recipient`, `occasion`, `dietary`, `location` (skip empty). NOT the date, NOT fixed labels.
- **English and Hebrew dictionaries keep identical keys** (guarded by `src/i18n/i18n.test.ts`). New keys go into both `en.ts` and `he.ts`.
- **Server tests never hit the network** — they inject a fake `Translator`. Frontend tests mock `fetch`. React components are verified by `npm run build` type-check, not unit tests.
- **Nothing saved to the database.** Translations live only in page memory; gone on refresh.
- **Build on `master`.** Routine commits (each task's code once done and passing) are made without asking; only push/merge/delete/spend/direction-changes need a pause.

---

### Task 1: Server `/api/translate` endpoint + MyMemory translator

Add the `Translator` interface and MyMemory implementation, wire a new route into `createApp`, and test the route against a fake translator. Deliverable: passing route tests; type-check passes.

**Files:**
- Create: `server/src/translator.ts`
- Modify: `server/src/app.ts` (change `createApp` signature; add the route)
- Modify: `server/src/index.ts` (create + pass the real translator)
- Modify: `server/src/app.test.ts` (add a fake translator; update existing `createApp` calls; add translate tests)

**Interfaces:**
- Produces:
  - `type Translator = { translate(text: string, from: string, to: string): Promise<string> }`
  - `createMyMemoryTranslator(): Translator`
  - `createApp(store: RequestsStore, translator: Translator): express.Express` with a new `POST /api/translate` → `{ translated }` (`400` on missing text / bad target, `500` on translator failure).

- [ ] **Step 1: Write the failing tests** — edit `server/src/app.test.ts`. Add a fake translator near `makeFakeStore`, update the four existing `createApp(makeFakeStore())` calls to also pass a fake translator, and add a `translate API` describe block.

Add this one import at the top (the file already imports `RequestsStore`, `CakeRequest`, and `RequestDraft` from Slice 2 — add only the translator type):

```ts
import type { Translator } from './translator';
```

Add this helper below `makeFakeStore`:

```ts
// An in-memory stand-in for the real MyMemory translator.
function makeFakeTranslator(): Translator {
  return {
    async translate(text: string, _from: string, to: string) {
      return `[${to}] ${text}`;
    },
  };
}
```

Update the four existing calls in the `requests API` block from `createApp(makeFakeStore())` to `createApp(makeFakeStore(), makeFakeTranslator())`.

Then add this new block at the end of the file:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `server/`): `npm test`
Expected: FAIL — `./translator` does not exist and/or `createApp` has no `/api/translate` route.

- [ ] **Step 3: Create `server/src/translator.ts`**

```ts
// What the translate endpoint needs from a translator. The real one calls the
// free MyMemory API; tests inject a fake with the same shape.
export type Translator = {
  translate(text: string, from: string, to: string): Promise<string>;
};

type MyMemoryResponse = {
  responseData?: { translatedText?: string };
};

// A translator backed by the free MyMemory API (no key required).
export function createMyMemoryTranslator(): Translator {
  return {
    async translate(text: string, from: string, to: string): Promise<string> {
      const url =
        'https://api.mymemory.translated.net/get' +
        `?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Translation service error (HTTP ${res.status})`);
      const data = (await res.json()) as MyMemoryResponse;
      const translated = data.responseData?.translatedText;
      if (!translated) throw new Error('Translation service returned no text');
      return translated;
    },
  };
}
```

- [ ] **Step 4: Update `server/src/app.ts`** — add the import, change the signature, add the route.

Change the imports block to add:

```ts
import type { Translator } from './translator';
```

Change the function signature line from `export function createApp(store: RequestsStore) {` to:

```ts
export function createApp(store: RequestsStore, translator: Translator) {
```

Add this route just before `return app;`:

```ts
  app.post('/api/translate', async (req, res) => {
    const { text, to } = (req.body ?? {}) as { text?: string; to?: string };
    if (!text || !text.trim() || (to !== 'en' && to !== 'he')) {
      res.status(400).json({ error: 'Missing text or invalid target language' });
      return;
    }
    const from = to === 'he' ? 'en' : 'he';
    try {
      const translated = await translator.translate(text, from, to);
      res.status(200).json({ translated });
    } catch {
      res.status(500).json({ error: 'Could not translate' });
    }
  });
```

- [ ] **Step 5: Update `server/src/index.ts`** to create and pass the real translator

```ts
import 'dotenv/config';
import { createApp } from './app';
import { createSupabaseStore } from './requestsStore';
import { createMyMemoryTranslator } from './translator';

const port = Number(process.env.PORT ?? 3001);
const store = createSupabaseStore();
const translator = createMyMemoryTranslator();
const app = createApp(store, translator);

app.listen(port, () => {
  console.log(`Bake the Cake server listening on http://localhost:${port}`);
});
```

- [ ] **Step 6: Run the tests to verify they pass**

Run (from `server/`): `npm test`
Expected: PASS — mapper test, all `requests API` tests, and the three `translate API` tests are green.

- [ ] **Step 7: Type-check the server**

Run (from `server/`): `npm run typecheck`
Expected: `tsc --noEmit` passes with no errors.

- [ ] **Step 8: Commit**

```bash
git add server/src/translator.ts server/src/app.ts server/src/index.ts server/src/app.test.ts
git commit -m "feat(server): add /api/translate endpoint via MyMemory"
```

---

### Task 2: Frontend `translateText` helper — TDD

The frontend's bridge to the translate endpoint, written test-first with `fetch` mocked (mirroring `requestsApi.test.ts`). Deliverable: passing helper tests.

**Files:**
- Create: `src/lib/translationApi.ts`
- Test: `src/lib/translationApi.test.ts`

**Interfaces:**
- Consumes: `Language` from `src/i18n/language.ts`.
- Produces: `translateText(text: string, to: Language): Promise<string>` — POST `{ text, to }` to `${VITE_API_BASE_URL}/api/translate`, returns `translated`.

- [ ] **Step 1: Write the failing test** `src/lib/translationApi.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateText } from './translationApi';

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://server.example');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('translationApi', () => {
  it('POSTs the text + target language and returns the translated string', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ translated: 'שלום' }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await translateText('hello', 'he');
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello', to: 'he' }),
    });
    expect(result).toBe('שלום');
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(translateText('hello', 'he')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from project root): `npm test`
Expected: FAIL — cannot find `./translationApi`.

- [ ] **Step 3: Create `src/lib/translationApi.ts`**

```ts
import type { Language } from '../i18n/language';

// The server's address, set per environment in the frontend .env file.
function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// Asks the server to translate one piece of text into the target language.
export async function translateText(text: string, to: Language): Promise<string> {
  const res = await fetch(`${apiBase()}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, to }),
  });
  if (!res.ok) throw new Error(`Could not translate (HTTP ${res.status})`);
  const data = (await res.json()) as { translated: string };
  return data.translated;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from project root): `npm test`
Expected: PASS — both `translationApi` tests plus all existing tests are green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/translationApi.ts src/lib/translationApi.test.ts
git commit -m "feat: add frontend translateText helper"
```

---

### Task 3: `RequestCard` component with the Translate button (+ i18n + styles)

Extract each card into its own `RequestCard` component that owns the translate/original toggle, add the four new i18n strings, simplify `RequestList`, pass `language` down from `App`, and style the button. Deliverable: the full Slice 3 experience — click Translate on a card and its text switches languages.

**Files:**
- Modify: `src/i18n/types.ts` (add four `list` strings)
- Modify: `src/i18n/en.ts` (add the four strings)
- Modify: `src/i18n/he.ts` (add the four strings)
- Create: `src/components/RequestCard.tsx`
- Modify (replace): `src/components/RequestList.tsx`
- Modify: `src/App.tsx` (pass `language` to `RequestList`)
- Modify (append): `src/styles/base.css`

**Interfaces:**
- Consumes: `translateText` from `src/lib/translationApi.ts`; `Language` from `src/i18n/language.ts`; `Dictionary` from `src/i18n/types.ts`; `CakeRequest` from `src/types.ts`.
- Produces: `RequestCard` (default export); `RequestList` now takes `{ t, language, requests }`.

- [ ] **Step 1: Add the four strings to the `Dictionary` `list` block** in `src/i18n/types.ts`

Inside the `list: { ... }` block, after `loadError`, add:

```ts
    translate: string; // Translate button label
    showOriginal: string; // toggle-back label
    translating: string; // busy label while a translation is in flight
    translateError: string; // shown when a translation fails
```

- [ ] **Step 2: Add the English strings** in `src/i18n/en.ts` (inside the `list` object, after `loadError`)

```ts
    translate: 'Translate',
    showOriginal: 'Show original',
    translating: 'Translating…',
    translateError: 'Could not translate. Please try again.',
```

- [ ] **Step 3: Add the Hebrew strings** in `src/i18n/he.ts` (inside the `list` object, after `loadError`)

```ts
    translate: 'תרגמו',
    showOriginal: 'הצג מקור',
    translating: 'מתרגם…',
    translateError: 'לא ניתן לתרגם. נסו שוב.',
```

- [ ] **Step 4: Create `src/components/RequestCard.tsx`**

```tsx
import { useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import { translateText } from '../lib/translationApi';

type Props = {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
};

type Mode = 'original' | 'translated';
type Status = 'idle' | 'loading' | 'error';

// The four typed-in text fields we translate (the date is never translated).
type Translated = {
  recipient: string;
  occasion: string;
  dietary: string;
  location: string;
};

export default function RequestCard({ t, language, request }: Props) {
  const [mode, setMode] = useState<Mode>('original');
  const [status, setStatus] = useState<Status>('idle');
  const [translated, setTranslated] = useState<Translated | null>(null);

  async function handleTranslateClick() {
    // Already showing the translation → flip back to the original.
    if (mode === 'translated') {
      setMode('original');
      return;
    }
    // We fetched it before → reuse the cache, no new network call.
    if (translated) {
      setMode('translated');
      return;
    }
    // First time → translate each non-empty field into the current language.
    setStatus('loading');
    try {
      const [recipient, occasion, dietary, location] = await Promise.all([
        translateText(request.recipient, language),
        translateText(request.occasion, language),
        request.dietary ? translateText(request.dietary, language) : Promise.resolve(''),
        translateText(request.location, language),
      ]);
      setTranslated({ recipient, occasion, dietary, location });
      setMode('translated');
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  const shown = mode === 'translated' && translated ? translated : request;
  const buttonLabel =
    status === 'loading'
      ? t.list.translating
      : mode === 'translated'
        ? t.list.showOriginal
        : t.list.translate;

  return (
    <li className="request-card">
      <h3>{shown.recipient}</h3>
      <p>{shown.occasion}</p>
      <p>
        {t.list.neededByPrefix} {request.neededBy}
      </p>
      <p>
        {t.list.locationPrefix} {shown.location}
      </p>
      {request.dietary && (
        <p>
          {t.list.dietaryPrefix} {shown.dietary}
        </p>
      )}
      <button type="button" onClick={handleTranslateClick} disabled={status === 'loading'}>
        {buttonLabel}
      </button>
      {status === 'error' && <p className="translate-error">{t.list.translateError}</p>}
    </li>
  );
}
```

- [ ] **Step 5: Replace `src/components/RequestList.tsx`** so it renders `RequestCard`s

```tsx
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import RequestCard from './RequestCard';

type Props = {
  t: Dictionary;
  language: Language;
  requests: CakeRequest[];
};

export default function RequestList({ t, language, requests }: Props) {
  return (
    <section className="request-list">
      <h2>{t.list.heading}</h2>
      {requests.length === 0 ? (
        <p className="empty">{t.list.empty}</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <RequestCard key={request.id} t={t} language={language} request={request} />
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Pass `language` to `RequestList` in `src/App.tsx`**

Change the line `{status === 'ready' && <RequestList t={t} requests={requests} />}` to:

```tsx
      {status === 'ready' && <RequestList t={t} language={language} requests={requests} />}
```

- [ ] **Step 7: Append the button/error styles to `src/styles/base.css`**

```css
.request-card button {
  margin-top: 0.5rem;
  font: inherit;
  padding: 0.3rem 0.7rem;
  border: 1px solid #d8b4b4;
  border-radius: 6px;
  background: #fff;
  color: #7a3e3e;
  cursor: pointer;
}

.request-card button:disabled {
  opacity: 0.6;
  cursor: default;
}

.translate-error {
  color: #c0392b;
  font-size: 0.9rem;
}
```

- [ ] **Step 8: Type-check / build and run all tests**

Run (from project root): `npm run build`
Expected: passes with no type errors.

Run (from project root): `npm test`
Expected: PASS — i18n key-parity (now covering the four new strings), language, `findMissingFields`, `requestsApi`, and `translationApi` tests all green.

- [ ] **Step 9: Full manual end-to-end check** (human step)

Run BOTH servers (two terminals):
- Terminal A (from `server/`): `npm run dev`
- Terminal B (from project root): `npm run dev` → open the printed URL.

Confirm:
1. The request list shows as usual, each card now has a **Translate** button.
2. Add a request in English (e.g. occasion "8th birthday", location "Haifa"), switch the page to עברית, click **Translate** on that card → the recipient/occasion/dietary/location switch to Hebrew, the button becomes **הצג מקור**.
3. Click **הצג מקור** → the card returns to the original English text (and this toggle is instant — no second network wait).
4. Switch back to English and Translate a Hebrew request the other direction.
5. Stop Terminal A's server, click Translate on a card → the friendly "could not translate" message appears and the card stays on the original. Restart the server; Translate works again.

Stop both servers with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add src/i18n/types.ts src/i18n/en.ts src/i18n/he.ts src/components/RequestCard.tsx src/components/RequestList.tsx src/App.tsx src/styles/base.css
git commit -m "feat: add per-card Translate button (toggle EN/HE via server)"
```

---

## Notes for whoever runs this plan

- **Two programs still run** (backend port 3001, frontend port 5173+). The Translate button needs the backend up, same as loading/saving requests.
- **MyMemory is free and keyless** but has a daily character limit per IP (generous for a demo). If translations suddenly fail, that limit (or being offline) is the likely cause — the card's error message will show.
- **Tests never hit the network** — the server injects a fake `Translator`; the frontend mocks `fetch`. The only real MyMemory calls are the human end-to-end step.
- **The user is new to coding.** Explain each task in plain English, keep steps small, and pause for the manual end-to-end run.
