# Slice 1: Cake Request Form + Open List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person fills out a cake-request form, clicks Submit, and their request appears at the top of an "Open requests" list on the same page.

**Architecture:** Frontend-only React app (no backend, no database). The list of requests lives in the browser's memory using React state — refreshing the page clears it, which is expected for Slice 1. All visible words come from swappable word-lists (`en` / `he`) from day one so Slice 1.5 (the language toggle) is a small step, not a rewrite. Pure logic (validation, building a request) lives in plain `.ts` files and is unit-tested; the React UI is verified by running the app.

**Tech Stack:** React 18 + TypeScript + Vite 5 (build tool / dev server) + Vitest 2 (test runner). Mirrors the `pocket-pt` project's setup exactly.

## Global Constraints

- **Node version:** Node 18 or newer (Vite 5 requirement).
- **Mirror pocket-pt:** same tool versions and config as `C:\Users\PC\pocket-pt` — React `^18.3.1`, Vite `^5.4.0`, TypeScript `^5.9.3`, Vitest `^2.1.8`, `@vitejs/plugin-react` `^4.3.4`.
- **Bilingual from the start:** no user-facing text typed directly into components. Every visible string comes from a dictionary in `src/i18n/`. English and Hebrew dictionaries must always have identical keys (enforced by a test).
- **Test config:** Vitest runs in the `node` environment and only picks up `src/**/*.test.ts` files (pure logic). React components are not unit-tested in this slice.
- **Ask before committing:** the user is new to coding and has asked to approve every commit. Each "Commit" step below means: show the change, get the user's OK, then commit. Never commit without asking.
- **Slice 1 does NOT:** save data permanently, notify anyone, handle bakers, or check for duplicates. Those are later slices.

---

### Task 1: Project scaffold (Vite + React + TypeScript + Vitest)

Replace the plain-HTML placeholder with a real React + Vite project that runs and can run tests. Deliverable: `npm run dev` shows a placeholder "Bake the Cake" screen, and `npm test` runs successfully (with zero tests for now).

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Modify (replace): `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx` (temporary placeholder, replaced in Task 6)
- Create: `src/styles/base.css` (minimal, expanded in Task 6)
- Delete: `styles.css`, `script.js` (old placeholder files)

**Interfaces:**
- Produces: a working dev server (`npm run dev`) and test runner (`npm test`); `src/App.tsx` default export mounted by `src/main.tsx`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bake-the-cake",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.9.3",
    "vite": "^5.4.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Replace `index.html`** with the React mount point

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bake the Cake</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/styles/base.css`** (minimal for now)

```css
:root {
  font-family: system-ui, sans-serif;
  color: #4a2f2f;
}

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, #ffe3ec, #fff6e5);
}
```

- [ ] **Step 6: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/base.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Create `src/App.tsx`** (temporary placeholder)

```tsx
export default function App() {
  return (
    <main>
      <h1>🍰 Bake the Cake</h1>
      <p>The React app is running. The real screen arrives next.</p>
    </main>
  );
}
```

- [ ] **Step 8: Delete the old placeholder files**

```bash
git rm styles.css script.js
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: creates `node_modules/` and `package-lock.json` with no errors.

- [ ] **Step 10: Verify the dev server runs**

Run: `npm run dev`
Expected: Vite prints a `http://localhost:5173/` URL; opening it shows the "Bake the Cake / The React app is running" placeholder. Stop the server with Ctrl+C.

- [ ] **Step 11: Verify the test runner works**

Run: `npm test`
Expected: Vitest runs and reports "No test files found" (or 0 tests) and exits cleanly. This confirms the test setup is wired correctly before we write any tests.

- [ ] **Step 12: Add a `.gitignore`** so `node_modules` and build output aren't committed

Create `.gitignore`:

```gitignore
node_modules
dist
```

- [ ] **Step 13: Commit** (after user approval)

```bash
git add .gitignore package.json package-lock.json tsconfig.json vite.config.ts index.html src/
git commit -m "chore: scaffold React + Vite + Vitest for Bake the Cake"
```

---

### Task 2: The cake-request type + bilingual word-lists

Define the shape of one cake request and the English/Hebrew dictionaries all screens read their text from. Deliverable: a passing test proving English and Hebrew have identical keys.

**Files:**
- Create: `src/types.ts`
- Create: `src/i18n/types.ts`
- Create: `src/i18n/en.ts`
- Create: `src/i18n/he.ts`
- Test: `src/i18n/i18n.test.ts`

**Interfaces:**
- Produces:
  - `src/types.ts`: `RequestDraft` (the form's fields) and `CakeRequest` (a saved request with `id` + `createdAt`).
  - `src/i18n/types.ts`: `Dictionary` type.
  - `src/i18n/en.ts`: `export const en: Dictionary`.
  - `src/i18n/he.ts`: `export const he: Dictionary`.

- [ ] **Step 1: Create `src/types.ts`**

```ts
// The fields a person types into the request form.
export type RequestDraft = {
  recipient: string; // who the cake is for
  occasion: string; // occasion / theme, e.g. "8th birthday, dinosaurs"
  neededBy: string; // date the cake is needed, as yyyy-mm-dd
  dietary: string; // dietary needs (optional; '' when none)
  location: string; // rough location, e.g. town or postcode
};

// A saved request: everything from the draft plus an id and a timestamp.
export type CakeRequest = RequestDraft & {
  id: string;
  createdAt: number; // milliseconds since 1970, used for ordering
};
```

- [ ] **Step 2: Create `src/i18n/types.ts`** (the dictionary shape both languages must match)

```ts
// The shape every language dictionary must fill in. If a new piece of text
// is added here, both en.ts and he.ts must provide it (the test enforces this).
export type Dictionary = {
  appTitle: string;
  tagline: string;
  form: {
    heading: string;
    recipientLabel: string;
    occasionLabel: string;
    neededByLabel: string;
    dietaryLabel: string;
    locationLabel: string;
    submit: string;
    missingFields: string; // gentle message when required fields are blank
  };
  list: {
    heading: string;
    empty: string; // shown when there are no requests yet
    neededByPrefix: string;
    dietaryPrefix: string;
    locationPrefix: string;
  };
};
```

- [ ] **Step 3: Create `src/i18n/en.ts`**

```ts
import type { Dictionary } from './types';

export const en: Dictionary = {
  appTitle: '🍰 Bake the Cake',
  tagline: 'Ask for a celebration cake, made with care by a volunteer.',
  form: {
    heading: 'Request a cake',
    recipientLabel: 'Who is the cake for?',
    occasionLabel: 'Occasion or theme',
    neededByLabel: 'Date needed',
    dietaryLabel: 'Dietary needs (optional)',
    locationLabel: 'Rough location',
    submit: 'Submit request',
    missingFields: 'Please fill in the required fields before submitting.',
  },
  list: {
    heading: 'Open requests',
    empty: 'No requests yet. Fill in the form to add the first one.',
    neededByPrefix: 'Needed by:',
    dietaryPrefix: 'Dietary:',
    locationPrefix: 'Location:',
  },
};
```

- [ ] **Step 4: Create `src/i18n/he.ts`** (Hebrew translations, same keys)

```ts
import type { Dictionary } from './types';

export const he: Dictionary = {
  appTitle: '🍰 להכין את העוגה',
  tagline: 'בקשו עוגה לחגיגה, שתיאפה באהבה על ידי מתנדב.',
  form: {
    heading: 'בקשת עוגה',
    recipientLabel: 'למי העוגה?',
    occasionLabel: 'אירוע או נושא',
    neededByLabel: 'תאריך נדרש',
    dietaryLabel: 'צרכים תזונתיים (רשות)',
    locationLabel: 'מיקום משוער',
    submit: 'שליחת בקשה',
    missingFields: 'אנא מלאו את שדות החובה לפני השליחה.',
  },
  list: {
    heading: 'בקשות פתוחות',
    empty: 'אין בקשות עדיין. מלאו את הטופס כדי להוסיף את הראשונה.',
    neededByPrefix: 'נדרש עד:',
    dietaryPrefix: 'תזונה:',
    locationPrefix: 'מיקום:',
  },
};
```

- [ ] **Step 5: Write the failing test** `src/i18n/i18n.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { en } from './en';
import { he } from './he';

// Walks a nested object and returns every leaf's dotted path, e.g. "form.submit".
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? keyPaths(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('i18n dictionaries', () => {
  it('English and Hebrew have exactly the same keys', () => {
    expect(keyPaths(he).sort()).toEqual(keyPaths(en).sort());
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 1 test, "English and Hebrew have exactly the same keys". (If it fails, a key is missing or misspelled in one dictionary; fix that dictionary.)

- [ ] **Step 7: Commit** (after user approval)

```bash
git add src/types.ts src/i18n/
git commit -m "feat: add cake-request types and English/Hebrew word-lists"
```

---

### Task 3: Request logic (validation + building a request) — TDD

The pure logic behind the form: which required fields are blank, and turning a filled draft into a saved request. Written test-first. Deliverable: passing tests for both functions.

**Files:**
- Create: `src/lib/requests.ts`
- Test: `src/lib/requests.test.ts`

**Interfaces:**
- Consumes: `RequestDraft`, `CakeRequest` from `src/types.ts`.
- Produces:
  - `findMissingFields(draft: RequestDraft): Array<keyof RequestDraft>` — the required fields still blank (whitespace counts as blank). `dietary` is never required.
  - `createRequest(draft: RequestDraft): CakeRequest` — trims text fields, adds a unique `id` and `createdAt` timestamp.

- [ ] **Step 1: Write the failing test** `src/lib/requests.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { findMissingFields, createRequest } from './requests';
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

describe('createRequest', () => {
  it('copies the draft fields, trimming surrounding spaces', () => {
    const draft: RequestDraft = { ...fullDraft, recipient: '  Maya  ' };
    const request = createRequest(draft);
    expect(request.recipient).toBe('Maya');
    expect(request.occasion).toBe('8th birthday, dinosaurs');
    expect(request.location).toBe('Haifa');
  });

  it('gives each request a different id', () => {
    const a = createRequest(fullDraft);
    const b = createRequest(fullDraft);
    expect(a.id).not.toBe(b.id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find `./requests` (the file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation** `src/lib/requests.ts`

```ts
import type { CakeRequest, RequestDraft } from '../types';

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

// A short id, unique enough for the in-memory list; works in the browser and in tests.
function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Turns a filled-in form draft into a full cake-request record.
export function createRequest(draft: RequestDraft): CakeRequest {
  return {
    id: makeId(),
    recipient: draft.recipient.trim(),
    occasion: draft.occasion.trim(),
    neededBy: draft.neededBy,
    dietary: draft.dietary.trim(),
    location: draft.location.trim(),
    createdAt: Date.now(),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `findMissingFields` and `createRequest` tests green.

- [ ] **Step 5: Commit** (after user approval)

```bash
git add src/lib/requests.ts src/lib/requests.test.ts
git commit -m "feat: add request validation and creation logic"
```

---

### Task 4: RequestForm component

The form itself: labelled inputs (text from the dictionary), a gentle message when required fields are blank, and clearing itself after a successful submit. Verified by running the app.

**Files:**
- Create: `src/components/RequestForm.tsx`

**Interfaces:**
- Consumes: `Dictionary` from `src/i18n/types.ts`; `RequestDraft` from `src/types.ts`; `findMissingFields` from `src/lib/requests.ts`.
- Produces: `RequestForm` (default export) taking props `{ t: Dictionary; onAdd: (draft: RequestDraft) => void }`. On submit: if any required field is blank it shows `t.form.missingFields` and does not call `onAdd`; otherwise it calls `onAdd(draft)`, clears the fields, and hides the error.

- [ ] **Step 1: Create `src/components/RequestForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import type { Dictionary } from '../i18n/types';
import type { RequestDraft } from '../types';
import { findMissingFields } from '../lib/requests';

const EMPTY_DRAFT: RequestDraft = {
  recipient: '',
  occasion: '',
  neededBy: '',
  dietary: '',
  location: '',
};

type Props = {
  t: Dictionary;
  onAdd: (draft: RequestDraft) => void;
};

export default function RequestForm({ t, onAdd }: Props) {
  const [draft, setDraft] = useState<RequestDraft>(EMPTY_DRAFT);
  const [showError, setShowError] = useState(false);

  function update(field: keyof RequestDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (findMissingFields(draft).length > 0) {
      setShowError(true);
      return;
    }
    onAdd(draft);
    setDraft(EMPTY_DRAFT);
    setShowError(false);
  }

  return (
    <form className="request-form" onSubmit={handleSubmit}>
      <h2>{t.form.heading}</h2>

      <label>
        {t.form.recipientLabel}
        <input value={draft.recipient} onChange={(e) => update('recipient', e.target.value)} />
      </label>

      <label>
        {t.form.occasionLabel}
        <input value={draft.occasion} onChange={(e) => update('occasion', e.target.value)} />
      </label>

      <label>
        {t.form.neededByLabel}
        <input type="date" value={draft.neededBy} onChange={(e) => update('neededBy', e.target.value)} />
      </label>

      <label>
        {t.form.dietaryLabel}
        <input value={draft.dietary} onChange={(e) => update('dietary', e.target.value)} />
      </label>

      <label>
        {t.form.locationLabel}
        <input value={draft.location} onChange={(e) => update('location', e.target.value)} />
      </label>

      {showError && <p className="form-error">{t.form.missingFields}</p>}

      <button type="submit">{t.form.submit}</button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check the component**

Run: `npm run build`
Expected: `tsc --noEmit` passes with no type errors (Vite build then completes). This is our check that the component is wired up correctly, since components aren't unit-tested.

- [ ] **Step 3: Commit** (after user approval)

```bash
git add src/components/RequestForm.tsx
git commit -m "feat: add cake request form component"
```

---

### Task 5: RequestList component

Shows the "Open requests" heading, a friendly empty state when there are none, and a card per request. Verified by running the app.

**Files:**
- Create: `src/components/RequestList.tsx`

**Interfaces:**
- Consumes: `Dictionary` from `src/i18n/types.ts`; `CakeRequest` from `src/types.ts`.
- Produces: `RequestList` (default export) taking props `{ t: Dictionary; requests: CakeRequest[] }`. Renders `t.list.empty` when the array is empty; otherwise one card per request. The optional `dietary` line only appears when `dietary` is non-empty.

- [ ] **Step 1: Create `src/components/RequestList.tsx`**

```tsx
import type { Dictionary } from '../i18n/types';
import type { CakeRequest } from '../types';

type Props = {
  t: Dictionary;
  requests: CakeRequest[];
};

export default function RequestList({ t, requests }: Props) {
  return (
    <section className="request-list">
      <h2>{t.list.heading}</h2>
      {requests.length === 0 ? (
        <p className="empty">{t.list.empty}</p>
      ) : (
        <ul>
          {requests.map((request) => (
            <li key={request.id} className="request-card">
              <h3>{request.recipient}</h3>
              <p>{request.occasion}</p>
              <p>
                {t.list.neededByPrefix} {request.neededBy}
              </p>
              <p>
                {t.list.locationPrefix} {request.location}
              </p>
              {request.dietary && (
                <p>
                  {t.list.dietaryPrefix} {request.dietary}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Type-check the component**

Run: `npm run build`
Expected: `tsc --noEmit` passes with no type errors.

- [ ] **Step 3: Commit** (after user approval)

```bash
git add src/components/RequestList.tsx
git commit -m "feat: add open-requests list component"
```

---

### Task 6: Wire it together in App + styling

Connect the form and list through App's in-memory state (a new request lands at the top of the list), and give the page a warm, cake-themed look. Deliverable: the full Slice 1 experience working in the browser.

**Files:**
- Modify (replace): `src/App.tsx`
- Modify (replace): `src/styles/base.css`

**Interfaces:**
- Consumes: `RequestForm`, `RequestList`, `en` dictionary, `createRequest`, `CakeRequest`, `RequestDraft`.
- Produces: the assembled Slice 1 screen. (Only English is shown in Slice 1; the language toggle is Slice 1.5.)

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useState } from 'react';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import { en } from './i18n/en';
import { createRequest } from './lib/requests';
import type { CakeRequest, RequestDraft } from './types';

export default function App() {
  const t = en; // Slice 1.5 will let this switch between en and he.
  const [requests, setRequests] = useState<CakeRequest[]>([]);

  function handleAdd(draft: RequestDraft) {
    const request = createRequest(draft);
    setRequests((prev) => [request, ...prev]); // newest first
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>{t.appTitle}</h1>
        <p>{t.tagline}</p>
      </header>
      <RequestForm t={t} onAdd={handleAdd} />
      <RequestList t={t} requests={requests} />
    </main>
  );
}
```

- [ ] **Step 2: Replace `src/styles/base.css`** with the full look

```css
:root {
  font-family: system-ui, sans-serif;
  color: #4a2f2f;
}

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, #ffe3ec, #fff6e5);
}

.app {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}

.app-header {
  text-align: center;
  margin-bottom: 2rem;
}

.app-header h1 {
  font-size: 2rem;
  margin-bottom: 0.25rem;
}

.request-form,
.request-list {
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  margin-bottom: 1.5rem;
}

.request-form h2,
.request-list h2 {
  margin-top: 0;
}

.request-form label {
  display: block;
  margin-bottom: 1rem;
  font-weight: 600;
}

.request-form input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 0.35rem;
  padding: 0.6rem 0.75rem;
  font-size: 1rem;
  border: 1px solid #f0c9d6;
  border-radius: 10px;
  font-weight: 400;
}

.form-error {
  color: #c0392b;
  font-weight: 600;
}

.request-form button {
  padding: 0.7rem 1.4rem;
  font-size: 1rem;
  border: none;
  border-radius: 999px;
  background: #ff6f91;
  color: white;
  cursor: pointer;
}

.request-form button:hover {
  background: #ff4d76;
}

.request-list .empty {
  color: #8a6d6d;
}

.request-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.request-card {
  border: 1px solid #ffe3ec;
  border-radius: 14px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.request-card h3 {
  margin: 0 0 0.25rem;
}

.request-card p {
  margin: 0.15rem 0;
}
```

- [ ] **Step 3: Type-check the whole app**

Run: `npm run build`
Expected: `tsc --noEmit` passes and Vite builds with no errors.

- [ ] **Step 4: Run the app and check the full flow by hand**

Run: `npm run dev`, open the printed URL, and confirm each of these:
1. The page shows the title, tagline, the form, and "Open requests" with the empty-state message.
2. Clicking **Submit** with blank fields shows the "please fill in the required fields" message and adds nothing.
3. Filling recipient, occasion, date, and location (dietary left blank) then Submit: the request appears as a card at the top of the list, and the form clears.
4. The dietary line only appears on cards where a dietary need was entered.
5. Adding a second request puts it above the first (newest first).

Expected: all five behave as described. Stop the server with Ctrl+C.

- [ ] **Step 5: Run the tests one last time**

Run: `npm test`
Expected: PASS — the i18n key-parity test and all `requests` logic tests are green.

- [ ] **Step 6: Commit** (after user approval)

```bash
git add src/App.tsx src/styles/base.css
git commit -m "feat: wire up Slice 1 request form + open list with styling"
```

---

## Notes for whoever runs this plan

- **This is Slice 1 of a larger roadmap.** The full vision and the later slices live in `docs/superpowers/specs/2026-08-20-bake-the-cake-design.md`.
- **In-memory only, on purpose.** Refreshing clears the list. Slice 2 adds a backend + database to fix that.
- **Hebrew is built but not switchable yet.** The `he` dictionary exists and stays in sync (the test guards it), but Slice 1 always shows English. Slice 1.5 adds the toggle and the right-to-left layout flip.
- **The user is new to coding.** Explain each task in plain English before doing it, keep steps small, and pause for approval before every commit.
