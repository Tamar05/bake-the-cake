# Slice 2 — Make It Remember (persistence) — Design

*Written 2026-08-20. Builds on Slice 1 + 1.5, on `master`. This is the slice where
the app gets a real backend and a real database.*

---

## 1. Goal

Cake requests **survive a page refresh** (and a browser close/reopen) because they
are saved in a real database instead of the browser's memory. After this slice,
adding a request, refreshing, and still seeing it — and seeing it appear in
Supabase's table viewer — is the proof it works.

## 2. Architecture — three parts talking in a chain

```
browser (React app)  →  server (Express)  →  Supabase (Postgres database)
```

- **Browser:** asks the server for the list of requests on startup, and posts new
  ones as they're submitted. It never talks to the database directly.
- **Server:** a small new Express program in a new `server/` folder. It is the
  ONLY thing that talks to Supabase, using Supabase's **secret service key**, kept
  in a private, git-ignored `server/.env` file.
- **Supabase:** a Postgres table `cake_requests` that permanently stores requests.

**Why the server sits in the middle:** the database's secret key must never live
in browser code (anyone could read it and abuse the database). The server holds
the secret and exposes only safe, specific actions. This is also the exact
foundation the future AI "Translate" button needs.

This mirrors the `pocket-pt` reference project (separate `server/` folder with its
own `package.json`; Express + cors + dotenv + `@supabase/supabase-js`; a small
data-mapping layer; endpoint tests with supertest).

## 3. The database table

One table, `cake_requests`, created by pasting a small SQL snippet into Supabase's
SQL editor (simpler for a beginner than the Supabase CLI):

| column | type | notes |
|--------|------|-------|
| `id` | uuid | primary key, database-generated (`gen_random_uuid()`) |
| `recipient` | text | who the cake is for |
| `occasion` | text | occasion / theme |
| `needed_by` | text | date needed (yyyy-mm-dd) |
| `dietary` | text | dietary needs, `''` when none |
| `location` | text | rough location |
| `created_at` | timestamptz | database-generated (`now()`), used for ordering |

Postgres columns use snake_case (`needed_by`, `created_at`); the app uses camelCase
(`neededBy`, `createdAt`). A tiny **mapper** in the server converts between the two,
so neither side has to know the other's naming. Row Level Security stays ON and
locked (no public policies) — only our server, holding the service key, reaches the
table, which is the safe default.

## 4. The server's two "doors" (endpoints)

- **GET `/api/requests`** → returns every request, newest first (ordered by
  `created_at` descending), as JSON.
- **POST `/api/requests`** → accepts a new request's fields, inserts a row (the
  database fills in `id` and `created_at`), and returns the saved request.

The server enables **CORS** for the frontend's local address so the browser is
allowed to call it.

## 5. What changes in the frontend

- **New** `src/lib/requestsApi.ts` — two functions, modeled on pocket-pt's
  `workoutLog.ts`:
  - `loadRequests(): Promise<CakeRequest[]>` — GETs the list from the server.
  - `saveRequest(draft: RequestDraft): Promise<CakeRequest>` — POSTs a new request
    and returns the saved one.
  - Both read the server's address from `import.meta.env.VITE_API_BASE_URL`.
- **`src/App.tsx`** changes from "requests live in memory" to:
  - On startup, load the list from the server (a `useEffect`), showing a simple
    loading state, and a friendly error message if the server can't be reached.
  - On submit, `saveRequest(draft)` then put the returned request at the top of the
    list. (The database now assigns the id + timestamp, so the frontend no longer
    creates them.)
- `src/lib/requests.ts`: `findMissingFields` (form validation) stays exactly as is.
  `createRequest` becomes unused by the app once the server assigns ids; it (and its
  tests) can be left in place for now or removed — the plan will remove it to avoid
  dead code, keeping `findMissingFields` and its tests.

## 6. Configuration & secrets

- **`server/.env`** (git-ignored, never committed): `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `PORT` (default `3001`).
- **`server/.env.example`** (committed): the same keys with blank/placeholder
  values, so it's clear what's needed without exposing secrets.
- **Frontend `.env`** (git-ignored): `VITE_API_BASE_URL=http://localhost:3001`.
- **Frontend `.env.example`** (committed): the same key with a placeholder.
- `.gitignore` updated so both `.env` files stay out of git.

## 7. Running it (two programs now)

Day-to-day, two things run at once, in two terminals:
- **Backend:** `npm run dev` inside `server/` (starts Express on port 3001).
- **Frontend:** `npm run dev` in the project root (starts the app on port 5173).

The plan will include clear, copy-paste commands and a short "how to run both"
note. Deploying to the real internet (Render + Cloudflare) is NOT part of this
slice — everything runs locally.

## 8. What this slice deliberately does NOT do

- No accounts / logins (Slice 4).
- No bakers browsing or reserving (Slice 3).
- No editing or deleting requests.
- No live deployment — local only.
- No translation of typed content (that Translate button comes after this slice).

## 9. How we'll know it works

- **Automated tests:**
  - Server: the snake_case↔camelCase mapper, and the two endpoints (tested with
    supertest against an in-memory fake store, so tests don't need real Supabase).
  - Frontend: `requestsApi` load/save functions (with `fetch` mocked, like
    pocket-pt's `workoutLog.test.ts`).
  - Existing Slice 1/1.5 tests keep passing.
- **By hand:** start both servers, add a request, **refresh** → it's still there;
  open Supabase's table viewer → the row is there too; the language toggle still
  works on the persisted list.

## 10. Setup you'll do (guided, at plan time)

1. Create a Supabase project for Bake the Cake.
2. Paste the table-creation SQL into Supabase's SQL editor and Run it.
3. Copy your project's URL and service key into `server/.env`.

I'll give exact clicks and the exact snippet when we execute.
