# Reserve Hold Box + Baker Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A baker holds an open cake for 1 hour from a hold box, then releases it or commits to bake it; committing emails the baker the recipient's full name, phone and the cake details, and no baker ever sees the name or phone inside the app.

**Architecture:** The server keeps the existing reserve / release / commit lifecycle (hold expiry is computed on read, no job). New: a small `emailer` module (Resend over `fetch`, injected into `createApp` like the other stores), a response "presenter" that adds `organizationName` and redacts recipient name/phone for every baker-facing response, and two client components (hold box, thank-you box). The email is built from the unredacted row the store returns to the server, never from a redacted API response.

**Tech Stack:** Node 22 + Express + Supabase (server, vitest + supertest); React 18 + Vite + react-router (client, vitest in node env, no DOM test library); Resend REST API via `fetch` (no new dependency).

**Spec:** `docs/superpowers/specs/2026-10-11-reserve-hold-and-baker-email-design.md`

## Global Constraints

- Node `>=22.0.0`; no new npm dependencies (Resend is called with `fetch`).
- Every new user-facing string goes in `src/i18n/types.ts`, `en.ts` AND `he.ts` (`i18n.test.ts` fails if keys differ).
- The recipient's full name and phone appear ONLY in the email for bakers; owner and admin still see their own request's details in the app.
- Email contents: recipient full name + phone + cake details (occasion, needed-by, location, dietary, kashrut, note about the recipient). NOT the organization name, NOT a link to the app.
- Secrets only in env vars on Render: `RESEND_API_KEY`, `EMAIL_FROM`. Nothing secret in the repo.
- Hold length stays `RESERVATION_MS` (1 hour); expiry stays computed on read.
- Commit subjects use Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`). Work in the worktree `C:\Users\PC\.worktrees\bake-the-cake\feat-reserve-hold-email`, never the main tree. No installs are needed: link `node_modules` from the main tree if missing (see Task 0).
- Plans are intent: file paths and line numbers are as of writing. Locate targets by the symbol/text quoted, and re-read the surrounding code before editing.

## Review Focus

1. A baker who commits while the baker's `profile.email` is null → commit is refused (409/400 with a clear message), the request stays `reserved` (no half-committed state). Pinned in Task 3.
2. Emailer throws (Resend down / key missing) → commit still succeeds, response has `emailSent: false`, and "send again" works later. Pinned in Task 3.
3. A second commit click / network retry → the same idempotency key means Resend delivers one email; the second commit call returns 409 (already committed) and sends nothing. Pinned in Task 3.
4. `reserve`, `release`, `commit`, `deliver` responses to a baker must not leak `recipient`/`contactPhone`/full `aboutRecipient` (the old code returned the raw row). Pinned in Task 2.
5. Hold expires while the hold box is open → box closes itself, no commit call is made with a stale hold; late commit gets the existing 409 and the box shows "the hour ran out". Pinned in Task 5 (pure countdown helper + API error mapping).

---

### Task 0: Worktree readiness

**Files:** none changed.

- [ ] **Step 1: Confirm the worktree and branch**

Run: `git -C C:/Users/PC/.worktrees/bake-the-cake/feat-reserve-hold-email status -sb`
Expected: `## feat/reserve-hold-email...origin/feat/reserve-hold-email` and a clean tree.

- [ ] **Step 2: Link dependencies (disk is almost full — do NOT run `npm install`)**

Run (PowerShell):
```powershell
$w = 'C:\Users\PC\.worktrees\bake-the-cake\feat-reserve-hold-email'
cmd /c mklink /J "$w\node_modules" 'C:\Users\PC\bake-the-cake\node_modules'
cmd /c mklink /J "$w\server\node_modules" 'C:\Users\PC\bake-the-cake\server\node_modules'
```
Expected: two "Junction created" lines. **Before the final commit of each task and before removing the worktree, delete the junctions with `cmd /c rmdir <path>` (NOT `rm -r`, which would delete the main tree's modules).** Make sure `node_modules` is not staged (`git status` must not list it; it is gitignored).

- [ ] **Step 3: Baseline**

Run: `npm --prefix server test` and `npm test` (repo root) and `npm --prefix server run typecheck`, `npx tsc --noEmit -p .`
Expected: all green before any change (server ~136+ tests, client ~88). Note the counts.

---

### Task 1: The emailer module

**Files:**
- Create: `server/src/emailer.ts`
- Create: `server/src/emailer.test.ts`

**Interfaces:**
- Produces:
  - `type EmailLang = 'en' | 'he'`
  - `type CommitEmailInput = { to: string; lang: EmailLang; request: CakeRequest; idempotencyKey: string }`
  - `type Emailer = { sendCommitEmail(input: CommitEmailInput): Promise<void> }` (throws on any failure)
  - `buildCommitEmail(request: CakeRequest, lang: EmailLang): { subject: string; text: string }`
  - `createResendEmailer(fetchImpl?: typeof fetch): Emailer`
  - `parseEmailLang(value: unknown): EmailLang` (anything but `'he'` → `'en'`)

- [ ] **Step 1: Write the failing tests** — create `server/src/emailer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCommitEmail, createResendEmailer, parseEmailLang } from './emailer';
import type { CakeRequest } from './types';

const request = {
  id: 'r1',
  recipient: 'Ruth Cohen',
  occasion: '8th birthday, dinosaurs',
  neededBy: '2026-11-01',
  dietary: 'nut-free, vegan',
  location: 'Haifa',
  kashrut: 'Rabbanut',
  aboutRecipient: 'Loves green and T-rex.',
  contactPhone: '+972501234567',
} as CakeRequest;

describe('buildCommitEmail', () => {
  it('includes the recipient name, phone and every cake detail (English)', () => {
    const { subject, text } = buildCommitEmail(request, 'en');
    expect(subject).toContain('Ruth Cohen');
    for (const part of [
      'Ruth Cohen',
      '+972501234567',
      '8th birthday, dinosaurs',
      '2026-11-01',
      'Haifa',
      'nut-free, vegan',
      'Rabbanut',
      'Loves green and T-rex.',
    ]) {
      expect(text).toContain(part);
    }
  });

  it('writes the Hebrew version when asked, still with name and phone', () => {
    const { subject, text } = buildCommitEmail(request, 'he');
    expect(/[\u0590-\u05FF]/.test(subject)).toBe(true);
    expect(text).toContain('Ruth Cohen');
    expect(text).toContain('+972501234567');
  });

  it('omits the dietary and note lines when empty, and never mentions an organization or link', () => {
    const { text } = buildCommitEmail({ ...request, dietary: '', aboutRecipient: '' }, 'en');
    expect(text).not.toMatch(/dietary/i);
    expect(text).not.toMatch(/about the recipient/i);
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/organi[sz]ation/i);
  });
});

describe('parseEmailLang', () => {
  it('accepts he, and falls back to en for anything else', () => {
    expect(parseEmailLang('he')).toBe('he');
    expect(parseEmailLang('en')).toBe('en');
    expect(parseEmailLang('fr')).toBe('en');
    expect(parseEmailLang(undefined)).toBe('en');
  });
});

describe('createResendEmailer', () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Bake the Cake <orders@bakethecake.org>';
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  it('POSTs to Resend with the key, an idempotency key and the message', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }));
    await createResendEmailer(fetchImpl as unknown as typeof fetch).sendCommitEmail({
      to: 'baz@example.com',
      lang: 'en',
      request,
      idempotencyKey: 'r1:123',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test');
    expect(headers['Idempotency-Key']).toBe('r1:123');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('Bake the Cake <orders@bakethecake.org>');
    expect(body.to).toEqual(['baz@example.com']);
    expect(body.text).toContain('+972501234567');
  });

  it('throws when Resend answers with an error status', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 403 }));
    await expect(
      createResendEmailer(fetchImpl as unknown as typeof fetch).sendCommitEmail({
        to: 'a@b.c',
        lang: 'en',
        request,
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/403/);
  });

  it('throws (without calling fetch) when the key or sender is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchImpl = vi.fn();
    await expect(
      createResendEmailer(fetchImpl as unknown as typeof fetch).sendCommitEmail({
        to: 'a@b.c',
        lang: 'en',
        request,
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/RESEND_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm --prefix server test -- emailer`
Expected: FAIL — cannot resolve `./emailer`.

- [ ] **Step 3: Implement** — create `server/src/emailer.ts`:

```ts
import type { CakeRequest } from './types';

export type EmailLang = 'en' | 'he';

export type CommitEmailInput = {
  to: string;
  lang: EmailLang;
  request: CakeRequest; // the UNREDACTED row — it carries the name and phone
  idempotencyKey: string;
};

// What the endpoints need to send the "you're baking this cake" email. The real
// one talks to Resend; tests inject a fake. Throws on ANY failure so the caller
// can report `emailSent: false` — a failed email never undoes a commit.
export type Emailer = {
  sendCommitEmail(input: CommitEmailInput): Promise<void>;
};

export function parseEmailLang(value: unknown): EmailLang {
  return value === 'he' ? 'he' : 'en';
}

// Plain, short, human text. Dietary and note lines appear only when filled in.
// Option values (dietary / kashrut) are the stored English identifiers.
export function buildCommitEmail(
  request: CakeRequest,
  lang: EmailLang,
): { subject: string; text: string } {
  const detail = (label: string, value: string) => `${label}: ${value}`;
  if (lang === 'he') {
    const lines = [
      'תודה שבחרתם לאפות את העוגה! הנה הפרטים לתיאום המסירה:',
      '',
      detail('שם מקבל/ת העוגה', request.recipient),
      detail('טלפון', request.contactPhone),
      '',
      detail('אירוע', request.occasion),
      detail('נדרשת בתאריך', request.neededBy),
      detail('אזור', request.location),
      detail('כשרות', request.kashrut),
    ];
    if (request.dietary) lines.push(detail('צרכים תזונתיים', request.dietary));
    if (request.aboutRecipient) lines.push('', detail('קצת על מקבל/ת העוגה', request.aboutRecipient));
    lines.push('', 'בהצלחה, ותודה!');
    return { subject: `פרטי המסירה לעוגה של ${request.recipient}`, text: lines.join('\n') };
  }
  const lines = [
    'Thank you for choosing to bake this cake! Here are the details to arrange delivery:',
    '',
    detail('Recipient', request.recipient),
    detail('Phone', request.contactPhone),
    '',
    detail('Occasion', request.occasion),
    detail('Needed by', request.neededBy),
    detail('Location', request.location),
    detail('Kashrut', request.kashrut),
  ];
  if (request.dietary) lines.push(detail('Dietary needs', request.dietary));
  if (request.aboutRecipient) lines.push('', detail('About the recipient', request.aboutRecipient));
  lines.push('', 'Good luck, and thank you!');
  return { subject: `Delivery details for ${request.recipient}'s cake`, text: lines.join('\n') };
}

// The production emailer: Resend's REST API over fetch (no SDK dependency).
// RESEND_API_KEY and EMAIL_FROM are read at send time so a missing value is a
// clear per-email failure, not a crash at server start.
export function createResendEmailer(fetchImpl: typeof fetch = fetch): Emailer {
  return {
    async sendCommitEmail({ to, lang, request, idempotencyKey }) {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!key) throw new Error('Missing RESEND_API_KEY');
      if (!from) throw new Error('Missing EMAIL_FROM');
      const { subject, text } = buildCommitEmail(request, lang);
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    },
  };
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npm --prefix server test -- emailer` then `npm --prefix server run typecheck`
Expected: PASS (7 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add server/src/emailer.ts server/src/emailer.test.ts
git commit -m "feat(email): emailer module with Resend sender and he/en commit message"
```

---

### Task 2: Organization name + no name/phone for bakers (server presenter)

**Files:**
- Modify: `server/src/types.ts` (add `organizationName: string` to `CakeRequest`)
- Modify: `server/src/requestMapper.ts` (return `organizationName: ''`)
- Modify: `server/src/profilesStore.ts` (add `getDisplayNames`)
- Modify: `server/src/app.ts` (`redactReserver`, new presenter, wrap every response)
- Modify: `server/src/app.test.ts` (fakes + the tests whose expectations change)
- Test: `server/src/app.test.ts`, `server/src/requestMapper.test.ts`

**Interfaces:**
- Consumes: `ProfilesStore.getContacts` pattern (id → value map).
- Produces:
  - `CakeRequest.organizationName: string` (`''` when unknown/legacy)
  - `ProfilesStore.getDisplayNames(ids: string[]): Promise<Record<string, string>>`
  - inside `createApp`: `presentMany(requests, viewer)` / `presentOne(request, viewer)` returning redacted requests with `organizationName` filled (best-effort: a lookup failure yields `''`, never a 500).

- [ ] **Step 1: Write failing tests** — in `server/src/app.test.ts`:

(a) In `makeFakeProfilesStore()` add (next to `getContacts`):
```ts
    async getDisplayNames(ids) {
      const known: Record<string, string> = {
        'user-req': 'Rae Bakery Friends',
        'user-req2': 'Ravi Org',
      };
      const map: Record<string, string> = {};
      for (const id of ids) if (id in known) map[id] = known[id];
      return map;
    },
```
(b) Add `organizationName: ''` next to every `galleryCaption: ''` inside request literals/fake store builders (the `addRequest` fake and the two seed literals near the stats/attention/gallery tests).
(c) Add a new describe at the end of the file:

```ts
describe('baker privacy + organization name', () => {
  const addOne = async (app: ReturnType<typeof createApp>) => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send({ ...validDraft, recipient: 'Ruth Cohen', aboutRecipient: 'x '.repeat(200) });
    return res.body.id as string;
  };
  const list = async (app: ReturnType<typeof createApp>, token?: string) => {
    const call = request(app).get('/api/requests');
    return (token ? await call.set('Authorization', `Bearer ${token}`) : await call).body;
  };

  it('shows the posting organization to everyone', async () => {
    const app = makeApp();
    await addOne(app);
    for (const token of [undefined, 'bak', 'adm', 'req']) {
      expect((await list(app, token))[0].organizationName).toBe('Rae Bakery Friends');
    }
  });

  it('never gives a baker the recipient name or phone, at any status', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const bakerView = async () =>
      (await list(app, 'bak')).find((r: { id: string }) => r.id === id);

    let card = await bakerView(); // open
    expect(card.recipient).toBe('');
    expect(card.contactPhone).toBe('');

    await request(app).post(`/api/requests/${id}/reserve`).set('Authorization', 'Bearer bak');
    card = await bakerView(); // reserved, held by this baker
    expect(card.recipient).toBe('');
    expect(card.contactPhone).toBe('');
    expect(card.aboutRecipient.length).toBeLessThan(400); // preview only

    await request(app).post(`/api/requests/${id}/commit`).set('Authorization', 'Bearer bak');
    card = await bakerView(); // committed
    expect(card.recipient).toBe('');
    expect(card.contactPhone).toBe('');
  });

  it('still shows the owner and admins the full request', async () => {
    const app = makeApp();
    await addOne(app);
    for (const token of ['req', 'adm']) {
      const card = (await list(app, token))[0];
      expect(card.recipient).toBe('Ruth Cohen');
      expect(card.contactPhone).toBe(validDraft.contactPhone);
    }
  });

  it('redacts the responses to reserve, release and commit as well', async () => {
    const app = makeApp();
    const id = await addOne(app);
    const reserve = await request(app)
      .post(`/api/requests/${id}/reserve`)
      .set('Authorization', 'Bearer bak');
    expect(reserve.body.recipient).toBe('');
    expect(reserve.body.contactPhone).toBe('');
    expect(reserve.body.organizationName).toBe('Rae Bakery Friends');
    const release = await request(app)
      .post(`/api/requests/${id}/release`)
      .set('Authorization', 'Bearer bak');
    expect(release.body.recipient).toBe('');
    expect(release.body.contactPhone).toBe('');
  });
});
```
(d) Update the three existing expectations that encode the OLD behaviour:
- test `shows the full recipient name only to the owner, the committed baker, and admins`: rename to `shows the recipient name only to the owner and admins` and change its two baker/anonymous expectations to `toBe('')`.
- test `keeps the requester’s phone private — visible only to owner, reserver, and admin`: rename to `… visible only to owner and admin`, and change the `phoneSeenBy('bak')` expectation to `toBe('')`.
- in `describe('commit API')` the assertion near `expect(res.body.contactPhone).toBe(validDraft.contactPhone);` (committing baker's response) → `toBe('')`.
(e) In `server/src/requestMapper.test.ts` add one test asserting `rowToRequest(baseRow).organizationName` is `''`.

- [ ] **Step 2: Run to confirm failure**

Run: `npm --prefix server test`
Expected: FAIL — new tests fail (and the changed ones fail against the old behaviour); `getDisplayNames` is not on the `ProfilesStore` type.

- [ ] **Step 3: Implement**

`server/src/types.ts` — in `CakeRequest`, after `ownerId`:
```ts
  organizationName: string; // the posting organization's name; '' for legacy rows or when unknown
```
`server/src/requestMapper.ts` — in the object returned by `rowToRequest`, add `organizationName: '',` (the app fills it in from profiles).

`server/src/profilesStore.ts` — in the `ProfilesStore` type add:
```ts
  // Display names (an organization's name, for requesters) for the given profile
  // ids, as an id → name map. Unknown ids are simply absent.
  getDisplayNames(ids: string[]): Promise<Record<string, string>>;
```
and implement it in `createSupabaseProfilesStore()` next to `getContacts` (mirror that method: guard on empty `ids`, `.from('profiles').select('id, display_name').in('id', ids)`, build the map, throw `new Error(error.message)` on error).

`server/src/app.ts`:
1. Replace the body of `redactReserver` with the rule from the spec (keep the function name and signature):
```ts
function redactReserver(request: CakeRequest, viewer: AuthedProfile | undefined): CakeRequest {
  const isAdmin = viewer?.role === 'admin';
  const isOwner = viewer != null && viewer.id === request.ownerId;
  const isHolder = viewer != null && viewer.id === request.reservedByUserId;
  let result = request;
  // The recipient's name and phone are NEVER shown to a baker in the app — not
  // while browsing, not during the hold, not after committing. A baker gets
  // them only in the email sent on commit. Only the owner and admins see them.
  if (!isAdmin && !isOwner) {
    result = { ...result, recipient: '', contactPhone: '' };
    if (request.aboutRecipient) {
      const preview = previewText(request.aboutRecipient, ABOUT_PREVIEW_MAX);
      if (preview !== request.aboutRecipient) result = { ...result, aboutRecipient: preview };
    }
  }
  // Who is baking it, the photo and the gallery caption stay private from
  // everyone except the owner, an admin and the baker who holds it.
  if (!isAdmin && !isOwner && !isHolder) {
    result = { ...result, galleryCaption: '' };
    if (request.reservedByUserId != null || request.reservedBy != null) {
      result = {
        ...result,
        reservedBy: null,
        reservedContact: null,
        reservedByUserId: null,
        hasPhoto: false,
      };
    }
  }
  return result;
}
```
Update the long comment above it to match (names/phones are never sent to bakers).

2. Inside `createApp`, after `const optAuth = ...`, add:
```ts
  // Fills in each request's organization name (the owner's profile display
  // name) and trims what this viewer may not see. The name lookup is
  // best-effort: if it fails the cards simply lack the organization line.
  async function presentMany(
    requests: CakeRequest[],
    viewer: AuthedProfile | undefined,
  ): Promise<CakeRequest[]> {
    let names: Record<string, string> = {};
    const ownerIds = [...new Set(requests.map((r) => r.ownerId).filter((id): id is string => id != null))];
    if (ownerIds.length > 0) {
      try {
        names = await profilesStore.getDisplayNames(ownerIds);
      } catch {
        names = {};
      }
    }
    return requests.map((r) =>
      redactReserver({ ...r, organizationName: r.ownerId ? (names[r.ownerId] ?? '') : '' }, viewer),
    );
  }
  async function presentOne(request: CakeRequest, viewer: AuthedProfile | undefined) {
    return (await presentMany([request], viewer))[0];
  }
```
3. `GET /api/requests`: replace `res.json(requests.map((r) => redactReserver(r, viewer)));` with `res.json(await presentMany(requests, viewer));`.
4. Wrap the baker-facing single-request responses with `presentOne(updated, me)`: in the **reserve**, **release**, **commit** and **deliver** handlers change `res.status(200).json(updated)` to `res.status(200).json(await presentOne(updated, me))`. Find the release handler (`/api/requests/:id/release`) by that path string; it follows the same pattern. Leave `receive`, edit (`PATCH`), `POST /api/requests` (the owner's own response) and gallery handlers as they are — those callers are the owner/admin.

- [ ] **Step 4: Run to confirm pass**

Run: `npm --prefix server test` and `npm --prefix server run typecheck`
Expected: PASS, typecheck clean. If an unrelated older test fails only because a fake store literal lacks `organizationName`, add the field there (do not loosen the type).

- [ ] **Step 5: Commit**

```bash
git add server/src
git commit -m "feat(privacy): bakers never see recipient name/phone; add organization name to requests"
```

---

### Task 3: Email on commit + "send it again" endpoint

**Files:**
- Modify: `server/src/app.ts` (`createApp` gets an `emailer` param; commit handler; new resend endpoint)
- Modify: `server/src/index.ts` (wire `createResendEmailer()`)
- Modify: `server/src/app.test.ts` (`makeApp` and a fake emailer; new tests)

**Interfaces:**
- Consumes: `Emailer`, `parseEmailLang` (Task 1); `presentOne` (Task 2).
- Produces:
  - `createApp(store, translator, authenticator?, profilesStore?, pushStore?, pushSender?, invitesStore?, emailer?)` — `emailer` is the new LAST parameter, default `createResendEmailer()`.
  - `POST /api/requests/:id/commit` body `{ lang?: 'en' | 'he' }` → `200` presented request plus `emailSent: boolean`.
  - `POST /api/requests/:id/resend-details` body `{ lang? }` → `200 { emailSent: true }` or `502 { error }` on send failure.

- [ ] **Step 1: Write failing tests** — in `server/src/app.test.ts`:

Add a fake emailer and thread it through `makeApp` (keep the existing call shape working — add a second optional argument):

```ts
import type { Emailer, CommitEmailInput } from './emailer';

function makeFakeEmailer(opts: { fail?: boolean } = {}) {
  const sent: CommitEmailInput[] = [];
  const emailer: Emailer = {
    async sendCommitEmail(input) {
      if (opts.fail) throw new Error('resend down');
      sent.push(input);
    },
  };
  return { emailer, sent };
}
```
Change `makeApp()` to `function makeApp(emailer: Emailer = makeFakeEmailer().emailer)` and pass `emailer` as the 8th argument to `createApp`.

New describe:

```ts
describe('commit email', () => {
  const setup = (opts: { fail?: boolean } = {}) => {
    const fake = makeFakeEmailer(opts);
    return { app: makeApp(fake.emailer), sent: fake.sent };
  };
  const addAndReserve = async (app: ReturnType<typeof createApp>, who = 'bak') => {
    const created = await request(app)
      .post('/api/requests')
      .set('Authorization', 'Bearer req')
      .send({ ...validDraft, recipient: 'Ruth Cohen' });
    const id = created.body.id as string;
    await request(app).post(`/api/requests/${id}/reserve`).set('Authorization', `Bearer ${who}`);
    return id;
  };
  const commit = (app: ReturnType<typeof createApp>, id: string, token = 'bak', body = {}) =>
    request(app).post(`/api/requests/${id}/commit`).set('Authorization', `Bearer ${token}`).send(body);

  it('emails the baker the full name and phone, and the response stays redacted', async () => {
    const { app, sent } = setup();
    const id = await addAndReserve(app);
    const res = await commit(app, id, 'bak', { lang: 'he' });
    expect(res.status).toBe(200);
    expect(res.body.emailSent).toBe(true);
    expect(res.body.recipient).toBe('');
    expect(res.body.contactPhone).toBe('');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('baz.baker@example.com'); // the baker's auth email
    expect(sent[0].lang).toBe('he');
    expect(sent[0].request.recipient).toBe('Ruth Cohen');
    expect(sent[0].request.contactPhone).toBe(validDraft.contactPhone);
    expect(sent[0].idempotencyKey).toContain(id);
  });

  it('still commits when the email fails, and reports emailSent:false', async () => {
    const { app } = setup({ fail: true });
    const id = await addAndReserve(app);
    const res = await commit(app, id);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('committed');
    expect(res.body.emailSent).toBe(false);
  });

  it('sends nothing on a repeated commit (409) and nothing when it is not your hold (403)', async () => {
    const { app, sent } = setup();
    const id = await addAndReserve(app);
    expect((await commit(app, id, 'bak2')).status).toBe(403);
    expect(sent).toHaveLength(0);
    expect((await commit(app, id)).status).toBe(200);
    expect((await commit(app, id)).status).toBe(409);
    expect(sent).toHaveLength(1);
  });

  it('refuses to commit when the baker has no email address, leaving the hold in place', async () => {
    const fake = makeFakeEmailer();
    const profiles = cloneProfiles();
    profiles.bak = { ...profiles.bak, email: null };
    const app = createApp(
      makeFakeStore(),
      makeFakeTranslator(),
      makeFakeAuthenticator(profiles),
      makeFakeProfilesStore(),
      undefined,
      undefined,
      makeFakeInvitesStore(profiles),
      fake.emailer,
    );
    const id = await addAndReserve(app);
    const res = await commit(app, id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/email/i);
    const after = (await request(app).get('/api/requests').set('Authorization', 'Bearer adm')).body;
    expect(after.find((r: { id: string }) => r.id === id).status).toBe('reserved');
  });

  it('lets only the committed baker (or an admin) re-send the details, and only once committed', async () => {
    const { app, sent } = setup();
    const id = await addAndReserve(app);
    const resend = (token: string) =>
      request(app).post(`/api/requests/${id}/resend-details`).set('Authorization', `Bearer ${token}`);
    expect((await resend('bak')).status).toBe(409); // still only reserved
    await commit(app, id);
    expect((await resend('bak2')).status).toBe(403);
    expect((await resend('req')).status).toBe(403);
    const ok = await resend('bak');
    expect(ok.status).toBe(200);
    expect(ok.body.emailSent).toBe(true);
    expect(sent).toHaveLength(2); // the commit email + the re-send
  });

  it('answers 502 when a re-send fails', async () => {
    const good = makeFakeEmailer();
    const app = makeApp(good.emailer);
    const id = await addAndReserve(app);
    await commit(app, id);
    // swap to a failing emailer via a second app sharing nothing is not possible;
    // instead make the fake fail from now on:
    good.sent.length = 0;
    (good.emailer as { sendCommitEmail: Emailer['sendCommitEmail'] }).sendCommitEmail = async () => {
      throw new Error('resend down');
    };
    const res = await request(app)
      .post(`/api/requests/${id}/resend-details`)
      .set('Authorization', 'Bearer bak');
    expect(res.status).toBe(502);
  });
});
```
(Use the real helper names already in the file: `cloneProfiles`, `makeFakeInvitesStore`. If `cloneProfiles` has a different name, find it by the comment "A fresh, independent copy of PROFILES".)

- [ ] **Step 2: Run to confirm failure**

Run: `npm --prefix server test -- app`
Expected: FAIL — emailer param/endpoint missing.

- [ ] **Step 3: Implement** — `server/src/app.ts`:

1. Imports: `import { createResendEmailer, parseEmailLang, type Emailer } from './emailer';`
2. Add the new last parameter to `createApp`: `emailer: Emailer = createResendEmailer(),`
3. Add a rate limiter next to `joinLimiter`:
```ts
// "Send the details again" costs an outbound email, so cap it per IP.
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again later.' },
});
```
4. Replace the commit handler's success path. The email address must exist BEFORE we change state, so check first:
```ts
  app.post('/api/requests/:id/commit', auth, requireRole('baker', 'admin'), async (req, res) => {
    const me = (req as AuthedRequest).auth;
    const lang = parseEmailLang((req.body ?? {}).lang);
    // The details go out by email only, so refuse (and leave the hold alone) if
    // this account has no address to send them to.
    if (!me.email) {
      res.status(409).json({ error: 'Your account has no email address, so we cannot send you the details' });
      return;
    }
    try {
      const updated = await store.commitRequest(req.params.id, me.id, me.role === 'admin');
      // `updated` is the unredacted row (it holds the name + phone). It goes into
      // the email; the HTTP response below is redacted like every other.
      let emailSent = false;
      try {
        await emailer.sendCommitEmail({
          to: me.email,
          lang,
          request: updated,
          idempotencyKey: `${updated.id}:${updated.committedAt ?? ''}`,
        });
        emailSent = true;
      } catch (err) {
        console.error('Could not send the commit email:', err);
      }
      res.status(200).json({ ...(await presentOne(updated, me)), emailSent });
    } catch (err) {
      /* keep the existing NOT_FOUND / NOT_RESERVER / INVALID_TRANSITION / 500 branches unchanged */
    }
  });
```
(Keep the existing `catch` branches exactly as they are; only the `try` body and the email-address guard are new. An admin committing on a baker's behalf gets the email themselves.)
5. Add after the commit handler:
```ts
  // Re-sends the delivery details to the baker who committed (or an admin) —
  // the only fallback if the first email went missing, since the app itself
  // never shows the recipient's name or phone to a baker.
  app.post(
    '/api/requests/:id/resend-details',
    resendLimiter,
    auth,
    requireRole('baker', 'admin'),
    async (req, res) => {
      const me = (req as AuthedRequest).auth;
      if (!me.email) {
        res.status(409).json({ error: 'Your account has no email address' });
        return;
      }
      try {
        const all = await store.listRequests();
        const target = all.find((r) => r.id === req.params.id);
        if (!target) {
          res.status(404).json({ error: 'Request not found' });
          return;
        }
        if (me.role !== 'admin' && target.reservedByUserId !== me.id) {
          res.status(403).json({ error: 'Only the baker baking this request can ask for the details' });
          return;
        }
        if (target.status !== 'committed') {
          res.status(409).json({ error: 'The details are sent once you commit to baking this cake' });
          return;
        }
        try {
          await emailer.sendCommitEmail({
            to: me.email,
            lang: parseEmailLang((req.body ?? {}).lang),
            request: target,
            idempotencyKey: `${target.id}:${target.committedAt ?? ''}:resend:${Date.now()}`,
          });
        } catch (err) {
          console.error('Could not re-send the details email:', err);
          res.status(502).json({ error: 'We could not send the email. Please try again.' });
          return;
        }
        res.status(200).json({ emailSent: true });
      } catch {
        res.status(500).json({ error: 'Could not send the details' });
      }
    },
  );
```
(`listRequests()` returns unredacted rows to server code; fine here because the content only goes to the baker's own inbox.)

`server/src/index.ts`: add `import { createResendEmailer } from './emailer';` and pass `createResendEmailer(),` as the new last argument to `createApp`.

- [ ] **Step 4: Run to confirm pass**

Run: `npm --prefix server test` and `npm --prefix server run typecheck`
Expected: all green. Note the new total.

- [ ] **Step 5: Commit**

```bash
git add server/src
git commit -m "feat(email): send delivery details to the baker on commit, with a send-again endpoint"
```

---

### Task 4: Client data layer, strings, form label and card content

**Files:**
- Modify: `src/types.ts` (add `organizationName: string`)
- Modify: `src/lib/requestsApi.ts` (`commitRequest` sends `lang`, returns `emailSent`; add `resendDetails`)
- Modify: `src/lib/requestsApi.test.ts` (tests for both)
- Modify: `src/i18n/types.ts`, `src/i18n/en.ts`, `src/i18n/he.ts` (new keys + changed texts)
- Modify: `src/components/RequestCard.tsx` (organization line, heading, remove phone line)

**Interfaces:**
- Produces:
  - `commitRequest(id: string, token: string, lang: Language): Promise<CommittedResult>` where `type CommittedResult = { request: CakeRequest; emailSent: boolean }`
  - `resendDetails(id: string, token: string, lang: Language): Promise<void>` (throws on non-2xx)
  - new `Dictionary['list']` keys: `organizationPrefix`, `reserveHint`, `openHold`, `holdTitle`, `holdIntro`, `notThisTime`, `bakeIt`, `holdWorking`, `holdExpired`, `holdTaken`, `thanksTitle`, `thanksBody`, `thanksEmailFailed`, `resendDetails`, `resendSending`, `resendDone`, `resendError`, `closeBox`, `signInToReserve`, `signInToReserve`

- [ ] **Step 1: Write failing tests** — in `src/lib/requestsApi.test.ts` Extend the file's import to `import { loadRequests, saveRequest, deleteRequest, commitRequest, resendDetails } from './requestsApi';` and add these inside the existing `describe('requestsApi', …)` block (same `vi.stubGlobal('fetch', …)` pattern as its other tests):

```ts
  it('commitRequest sends the language and returns the request plus emailSent', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'id1', status: 'committed', emailSent: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await commitRequest('id1', 'tok', 'he');
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests/id1/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ lang: 'he' }),
    });
    expect(result.emailSent).toBe(true);
    expect(result.request.id).toBe('id1');
    expect(result.request).not.toHaveProperty('emailSent');
  });

  it('commitRequest throws on a non-2xx answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({}) }));
    await expect(commitRequest('id1', 'tok', 'en')).rejects.toThrow(/409/);
  });

  it('resendDetails POSTs the language and resolves on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ emailSent: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(resendDetails('id1', 'tok', 'en')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests/id1/resend-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ lang: 'en' }),
    });
  });

  it('resendDetails throws when the server cannot send (502)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    await expect(resendDetails('id1', 'tok', 'en')).rejects.toThrow(/502/);
  });
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- requestsApi`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/types.ts`: in `CakeRequest` after `ownerId` add `organizationName: string; // the posting organization's name; '' when unknown`.

`src/lib/requestsApi.ts`: add `import type { Language } from '../i18n/language';` and replace `commitRequest`; add `resendDetails`:
```ts
export type CommittedResult = { request: CakeRequest; emailSent: boolean };

// The reserving baker commits to bake a request they're holding. The server
// emails them the recipient's details (in `lang`) and says whether it went out.
export async function commitRequest(
  id: string,
  token: string,
  lang: Language,
): Promise<CommittedResult> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lang }),
  });
  if (!res.ok) throw new Error(`Could not commit to request (HTTP ${res.status})`);
  const { emailSent, ...request } = (await res.json()) as CakeRequest & { emailSent: boolean };
  return { request: request as CakeRequest, emailSent };
}

// Asks the server to e-mail the committed baker the delivery details again.
export async function resendDetails(id: string, token: string, lang: Language): Promise<void> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/resend-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lang }),
  });
  if (!res.ok) throw new Error(`Could not re-send the details (HTTP ${res.status})`);
}
```

i18n — add the keys to the `list` section of `src/i18n/types.ts` (type `string` each, with short comments), then values:

`en.ts` (`list`):
```ts
    organizationPrefix: 'Posted by:',
    reserve: 'Reserve this cake',
    reserveHint: 'Reserving lets you hold it for 1 hour.',
    openHold: 'Open my hold',
    holdTitle: 'This cake is on hold for you',
    holdIntro: 'You have 1 hour to decide. If you do nothing, the cake goes back to the list.',
    notThisTime: 'Not this time',
    bakeIt: 'I’ll bake it',
    holdWorking: 'Saving…',
    holdExpired: 'The hour ran out, so the cake is open again.',
    holdTaken: 'Sorry, this cake is no longer on hold for you.',
    thanksTitle: 'Thank you!',
    thanksBody: 'Please check your email: we sent you the recipient’s name, phone number and the cake details.',
    thanksEmailFailed: 'We could not send the email just now. Press the button below to try again.',
    resendDetails: 'Send me the details again',
    resendSending: 'Sending…',
    resendDone: 'Sent! Please check your email.',
    resendError: 'Could not send the email. Please try again.',
    closeBox: 'Close',
    signInToReserve: 'You’re not signed in. Please sign in or sign up to reserve a cake.',
```
(`reserve` already exists — change its text, do not duplicate the key. Also delete the now-unused English `deliveryPhonePrefix` line's text only if the type key is also removed; simplest: leave the key and value, it is just unused.)

`he.ts` (`list`):
```ts
    organizationPrefix: 'פורסם על ידי:',
    reserve: 'לשמור את העוגה',
    reserveHint: 'שמירה מאפשרת לכם להחזיק בעוגה למשך שעה אחת.',
    openHold: 'פתיחת השמירה שלי',
    holdTitle: 'העוגה שמורה בשבילכם',
    holdIntro: 'יש לכם שעה להחליט. אם לא תבחרו, העוגה תחזור לרשימה.',
    notThisTime: 'לא הפעם',
    bakeIt: 'אני אופה אותה',
    holdWorking: 'שומרים…',
    holdExpired: 'השעה הסתיימה והעוגה חזרה להיות פתוחה.',
    holdTaken: 'מצטערים, העוגה כבר לא שמורה בשבילכם.',
    thanksTitle: 'תודה רבה!',
    thanksBody: 'בדקו את תיבת הדואר: שלחנו לכם את שם מקבל/ת העוגה, הטלפון ופרטי העוגה.',
    thanksEmailFailed: 'לא הצלחנו לשלוח את המייל כרגע. לחצו על הכפתור למטה כדי לנסות שוב.',
    resendDetails: 'שלחו לי שוב את הפרטים',
    resendSending: 'שולחים…',
    resendDone: 'נשלח! בדקו את תיבת הדואר.',
    resendError: 'לא הצלחנו לשלוח את המייל. נסו שוב.',
    closeBox: 'סגירה',
    signInToReserve: 'לא התחברתם. אנא התחברו או הירשמו כדי לשמור עוגה.',
```
Form wording (`form` section): English `contactPhoneLabel: 'Recipient’s phone'`, `contactPhoneHint: 'The baker will use this number to arrange delivery.'`; Hebrew keeps its label `'טלפון של מקבל/ת העוגה'` and `contactPhoneHint: 'האופה ישתמש במספר הזה כדי לתאם את המסירה.'`.

`src/components/RequestCard.tsx`:
- Heading: replace `<h3>{shown.recipient}</h3>` with `<h3>{shown.recipient || request.organizationName || shown.occasion}</h3>`. (Owner/admin still see the recipient name; a baker sees the organization.)
- After the occasion/needed-by lines add (only when present):
```tsx
      {request.organizationName && (
        <p>
          {t.list.organizationPrefix} {request.organizationName}
        </p>
      )}
```
- Delete the whole `{(committed || delivered || received) && request.contactPhone && (…delivery-phone…)}` block and its comment (the phone is never shown to a baker; the owner already knows their own number).
- Do not touch the reserve/commit/release handlers in this task (Task 5 replaces them). To keep the build green after the `commitRequest` signature change, temporarily update the existing `handleCommit` call to `(await commitRequest(request.id, token, language)).request`.
- `TEXT_FIELDS` / `Translated` still include `recipient`; `shown.recipient` may now be `''` — confirm the translate button is not offered for an empty field (`fieldNeedsTranslation` must be false for `''`; if it is not, guard with `request.recipient !== ''`).

- [ ] **Step 4: Run to confirm pass**

Run: `npm test` and `npx tsc --noEmit -p .`
Expected: PASS (i18n key-parity test included), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(ui): organization on cards, no recipient phone in-app, recipient-phone wording, commit API returns emailSent"
```

---

### Task 5: Hold box, thank-you box and the new reserve button

**Files:**
- Create: `src/lib/holdCountdown.ts`, `src/lib/holdCountdown.test.ts`
- Create: `src/components/HoldBox.tsx`
- Modify: `src/components/RequestCard.tsx`
- Modify: `src/styles/base.css` (modal styles)

**Interfaces:**
- Consumes: `commitRequest`, `releaseRequest`, `resendDetails` (Task 4), the `list.*` strings (Task 4).
- Produces:
  - `holdRemaining(reservedUntil: number | null, now: number): { expired: boolean; minutes: number; seconds: number }`
  - `<HoldBox t language request token onUpdated onClose />` — `onUpdated(req)` receives the changed request; `onClose()` is called when the box should go away.

- [ ] **Step 1: Write the failing test** — `src/lib/holdCountdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { holdRemaining } from './holdCountdown';

describe('holdRemaining', () => {
  it('splits the remaining time into minutes and seconds', () => {
    expect(holdRemaining(1_000_000 + 61_000, 1_000_000)).toEqual({ expired: false, minutes: 1, seconds: 1 });
    expect(holdRemaining(1_000_000 + 3_600_000, 1_000_000)).toEqual({ expired: false, minutes: 60, seconds: 0 });
  });
  it('is expired at exactly zero and after', () => {
    expect(holdRemaining(5_000, 5_000)).toEqual({ expired: true, minutes: 0, seconds: 0 });
    expect(holdRemaining(5_000, 9_000)).toEqual({ expired: true, minutes: 0, seconds: 0 });
  });
  it('treats a missing deadline as expired (never a negative or NaN countdown)', () => {
    expect(holdRemaining(null, 1)).toEqual({ expired: true, minutes: 0, seconds: 0 });
  });
});
```

- [ ] **Step 2: Run to confirm failure** — `npm test -- holdCountdown` → FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/holdCountdown.ts`:
```ts
// How much of a 1-hour hold is left. The server's `reservedUntil` is the source
// of truth; the browser clock only renders it. A missing deadline counts as
// expired so the box can never show a bogus time.
export function holdRemaining(
  reservedUntil: number | null,
  now: number,
): { expired: boolean; minutes: number; seconds: number } {
  if (reservedUntil == null || reservedUntil <= now) return { expired: true, minutes: 0, seconds: 0 };
  const ms = reservedUntil - now;
  return { expired: false, minutes: Math.floor(ms / 60000), seconds: Math.floor((ms % 60000) / 1000) };
}
```

`src/components/HoldBox.tsx` (a modal overlay; one component, two views — choosing and thanks):
```tsx
import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import { commitRequest, releaseRequest, resendDetails } from '../lib/requestsApi';
import { holdRemaining } from '../lib/holdCountdown';

type Props = {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
  token: string;
  onUpdated: (updated: CakeRequest) => void;
  onClose: () => void;
};

type View = 'choose' | 'thanks';
type Busy = 'idle' | 'working' | 'error';
type Resend = 'idle' | 'sending' | 'done' | 'error';

// The hold box: shown while a baker is holding a cake. Two choices — let it go,
// or commit to bake it (which e-mails them the recipient's details). The hour is
// counted from the server's deadline; when it runs out the box closes itself.
export default function HoldBox({ t, language, request, token, onUpdated, onClose }: Props) {
  const [view, setView] = useState<View>('choose');
  const [busy, setBusy] = useState<Busy>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(true);
  const [committed, setCommitted] = useState<CakeRequest | null>(null);
  const [resend, setResend] = useState<Resend>('idle');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (view !== 'choose') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view]);

  const { expired, minutes, seconds } = holdRemaining(request.reservedUntil, now);

  // When the hour runs out the cake is open again: tell the baker and close.
  useEffect(() => {
    if (view === 'choose' && expired) {
      window.alert(t.list.holdExpired);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, view]);

  async function letGo() {
    setBusy('working');
    try {
      onUpdated(await releaseRequest(request.id, token));
      onClose();
    } catch {
      setBusy('error');
      setMessage(t.list.holdTaken);
    }
  }

  async function bake() {
    setBusy('working');
    try {
      const result = await commitRequest(request.id, token, language);
      // Keep the card on screen until the thank-you box is closed: the moment the
      // list learns it is committed, Browse drops it (see RequestCard).
      setCommitted(result.request);
      setEmailSent(result.emailSent);
      setView('thanks');
      setBusy('idle');
    } catch {
      setBusy('error');
      setMessage(t.list.holdTaken);
    }
  }

  async function sendAgain() {
    setResend('sending');
    try {
      await resendDetails(request.id, token, language);
      setResend('done');
    } catch {
      setResend('error');
    }
  }

  function finish() {
    if (committed) onUpdated(committed);
    onClose();
  }

  return (
    <div className="hold-overlay" role="dialog" aria-modal="true">
      <div className="hold-box">
        {view === 'choose' ? (
          <>
            <h2>{t.list.holdTitle}</h2>
            <p>{t.list.holdIntro}</p>
            <p className="countdown">
              {t.list.timeLeftPrefix} {minutes}m {seconds}s
            </p>
            {busy === 'error' && message && <p className="reserve-error">{message}</p>}
            <div className="hold-actions">
              <button type="button" onClick={letGo} disabled={busy === 'working'}>
                {t.list.notThisTime}
              </button>
              <button type="button" className="reserve-button" onClick={bake} disabled={busy === 'working'}>
                {busy === 'working' ? t.list.holdWorking : t.list.bakeIt}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{t.list.thanksTitle}</h2>
            <p>{emailSent || resend === 'done' ? t.list.thanksBody : t.list.thanksEmailFailed}</p>
            {(!emailSent || resend !== 'idle') && resend !== 'done' && (
              <button type="button" onClick={sendAgain} disabled={resend === 'sending'}>
                {resend === 'sending' ? t.list.resendSending : t.list.resendDetails}
              </button>
            )}
            {resend === 'done' && <p>{t.list.resendDone}</p>}
            {resend === 'error' && <p className="reserve-error">{t.list.resendError}</p>}
            <button type="button" className="reserve-button" onClick={finish}>
              {t.list.closeBox}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```
(`window.alert` for the expiry notice is deliberate to keep the component small; if an inline message is preferred later, that is a follow-up.)

`src/components/RequestCard.tsx`:
- `import HoldBox from './HoldBox';` and add `const [holdOpen, setHoldOpen] = useState(false);`
- `handleReserve`: after `onUpdated(await reserveRequest(request.id, token));` add `setHoldOpen(true);`. A 409 (someone else just reserved it) already lands in the existing `reserveError` text; keep that.
- Replace the commit button group (`{canCommit && (…)}`) with a single "open my hold" button, and remove the now-redundant inline release button for the active hold (keep the admin `canRelease` for committed):
```tsx
          {canCommit && (
            <button type="button" className="reserve-button" onClick={() => setHoldOpen(true)}>
              {t.list.openHold}
            </button>
          )}
          {canRelease && !reservedActive && (
            <>
              <button type="button" onClick={handleRelease} disabled={releaseStatus === 'saving'}>
                {releaseStatus === 'saving' ? t.list.releasing : t.list.release}
              </button>
              {releaseStatus === 'error' && <p className="reserve-error">{t.list.releaseError}</p>}
            </>
          )}
```
- Delete `handleCommit` and the unused `commitStatus` state and the `commitRequest` import from this file (HoldBox owns commit now). Keep the "navigate to /reservations after commit" behaviour by doing it when the box closes after a commit: pass `onClose` as
```tsx
          onClose={() => {
            setHoldOpen(false);
            if (request.status === 'committed' && profile?.role === 'baker') navigate('/reservations');
          }}
```
  (read the existing `handleCommit` to copy exactly how/when it navigated; preserve that condition.)
- Signed-out visitors: today the card shows them no reserve button at all. Change it so a visitor with no `profile` (and not still loading: use `!profile && !authLoading`, reading `loading` from `useAuth()`) sees the same "Reserve this cake" button and hint; pressing it does NOT call the server, it just shows `t.list.signInToReserve` under the button (`<p className="reserve-error">`). Signed-in bakers reserve as before; signed-in organizations (requesters) still see no button; unverified bakers still see the pending note. (The server already answers 401 to a reserve call with no login, covered by the existing "auth negative tests"; add one assertion there if `reserve` is missing from that list.)
- Under the reserve button (`canReserve` branch) add the hint line:
```tsx
          <p className="reserve-hint">{t.list.reserveHint}</p>
```
- Render the box at the end of the `<li>`, before `</li>`:
```tsx
      {holdOpen && token && reservedActive && (
        <HoldBox
          t={t}
          language={language}
          request={request}
          token={token}
          onUpdated={onUpdated}
          onClose={() => setHoldOpen(false) /* use the version above with navigate */}
        />
      )}
```
  Note: once the commit succeeds, `request.status` is still `reserved` in the card (HoldBox defers `onUpdated` until the thank-you is closed), so `reservedActive` stays true and the box stays mounted. Verify this by reading the final code; if the card flips to committed early, keep the box mounted with a separate `holdOpen` flag only.

`src/styles/base.css` — append:
```css
/* The hold box: a centred card over a dimmed page. */
.hold-overlay {
  position: fixed;
  inset: 0;
  background: rgba(60, 30, 30, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 50;
}
.hold-box {
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  width: min(440px, 100%);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hold-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.hold-actions button {
  flex: 1 1 140px;
}
.reserve-hint {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: #7a6a6a;
}
```
(Match the colour variables the file already uses if it defines CSS custom properties — read the top of the file and reuse them instead of the literals above.)

- [ ] **Step 4: Run to confirm pass**

Run: `npm test`, `npx tsc --noEmit -p .`, `npm run build`
Expected: tests pass (holdCountdown included), typecheck clean, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(ui): hold box with countdown, not-this-time / I'll bake it, thank-you box and reserve hint"
```

---

### Task 6: Environment, runbook, and final verification

**Files:**
- Modify: `DEPLOY.md` (add the email setup section)
- Create/Modify: `server/.env.example` (add the two variables, if the file exists; otherwise document in DEPLOY.md only)
- Modify: `README.md` only if it lists features/env vars that now changed

- [ ] **Step 1: Document the email setup in `DEPLOY.md`** — add a section "Baker emails (Resend)" with: the two Render env vars `RESEND_API_KEY` (a Resend API key with "Sending access") and `EMAIL_FROM` (`Bake the Cake <orders@bakethecake.org>`), the requirement that `bakethecake.org` shows **Verified** in Resend → Domains, and the fact that until it is verified Resend only delivers to the Resend account owner's own address.

- [ ] **Step 2: Full local verification**

Run: `npm --prefix server test`, `npm --prefix server run typecheck`, `npm test`, `npx tsc --noEmit -p .`, `npm run build`
Expected: all green; record the final test counts.

- [ ] **Step 3: Remove the node_modules junctions** (see Task 0 step 2: `cmd /c rmdir`), confirm `git status` is clean, push the branch: `git push -u origin feat/reserve-hold-email`.

- [ ] **Step 4: Hand-over to the user (do not skip; these are the user's own steps)** — give the user these, written for a non-technical reader:
  1. **Check the organization name is saved where the app reads it.** Supabase → SQL Editor → run (read-only): `select id, display_name, role from profiles where role = 'requester' limit 5;` — the organization's name (e.g. "Org test") should appear in `display_name`. If it does not, tell Claude what the column looks like; a one-line fix will be added.
  2. **Verify the email domain.** resend.com → **Domains** → `bakethecake.org` must say **Verified**. If not, follow Resend's DNS steps in Cloudflare (DNS records tab) and wait until it turns green.
  3. **Create the sending key.** resend.com → **API Keys** → **Create API Key** → permission **Sending access** → copy it once.
  4. **Add the two variables on Render.** Render dashboard → the bake-the-cake service → **Environment** → add `RESEND_API_KEY` (the key) and `EMAIL_FROM` (`Bake the Cake <orders@bakethecake.org>`) → **Save, rebuild, and deploy**.
  5. After Claude merges the branch to `master` (needs the user's go-ahead) and Cloudflare/Render redeploy: test with a real baker account — reserve a cake, press "I'll bake it", and confirm the email arrives with the recipient's name and phone and that neither appears anywhere on the cards.

- [ ] **Step 5: Mark the workboard** — `py ~/.ai-instructions/tools/workboard.py update-status --feature "Reserve hold box + baker email" --status waiting --reason "Implemented + pushed; waiting for user go-ahead to merge to master and for Resend setup"`.

---

## Self-review

**Spec coverage:** organization on cards (Task 2 server, Task 4 UI) ✓; area/dietary/kashrut/occasion shown and no name/phone (Task 2 redaction, Task 4 heading + removal of phone line) ✓; "Reserve this cake" + hint (Tasks 4–5) ✓; hold box with countdown, Not this time / I'll bake it, auto-expire, reopen from My reservations via the "Open my hold" button (Task 5) ✓; thank-you box (Task 5) ✓; email with name, phone, cake details, no org/link, language (Tasks 1, 3) ✓; recipient-phone wording on the form and same value emailed (Task 4; value flows from `contactPhone`) ✓; send-it-again fallback (Task 3 + Task 5) ✓; no email on file → commit refused (Task 3) ✓; privacy tightening at all statuses, owner/admin keep access (Task 2) ✓; Resend setup + domain check + organization-name check handed to the user (Task 6) ✓; old specs marked superseded (already done in the spec commit) ✓.

**Placeholder scan:** none left; every code step carries code.

**Type consistency:** `Emailer`/`CommitEmailInput`/`EmailLang`/`parseEmailLang` (Task 1) are used with the same names in Task 3; `presentMany`/`presentOne` (Task 2) are used in Task 3; `commitRequest(id, token, lang): Promise<CommittedResult>` and `resendDetails(id, token, lang)` (Task 4) match their use in `HoldBox` (Task 5); `holdRemaining` (Task 5) matches its test; `list.*` keys listed in Task 4 are exactly those used in `HoldBox`/`RequestCard` (`organizationPrefix, reserve, reserveHint, openHold, holdTitle, holdIntro, notThisTime, bakeIt, holdWorking, holdExpired, holdTaken, thanksTitle, thanksBody, thanksEmailFailed, resendDetails, resendSending, resendDone, resendError, closeBox, signInToReserve`).
