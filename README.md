# Bake the Cake 🍰

A charity web app that connects people who need a celebration cake with
volunteer bakers who make one for free. Same tech stack as the pocket-pt
project (React + TypeScript + Vite frontend, Express backend, Supabase database).

---

## 👉 START HERE — how to continue building

This project was built **one small slice at a time**, and the core app is now
done (see the roadmap status below). The original plan lives here:

**`docs/superpowers/specs/2026-08-20-bake-the-cake-design.md`** — with a
detailed spec per slice under `docs/superpowers/specs/`.

To pick up work with Claude Code:

1. Open this `bake-the-cake` folder in VS Code (you're likely here already).
2. Trust the folder if VS Code asks (dismiss "Restricted Mode").
3. Start both servers (see **Running it locally** below) so you can test.
4. Open Claude Code **in this window** and tell it what you'd like next — e.g.
   *"the core app is built; let's add the next Slice 7 magic touch"* or a fix.
   Claude also keeps project memory, so a fresh chat already knows where things
   stand.

---

## Accounts & roles — making the first admin

The app has three kinds of account: **requester** (asks for cakes), **baker**
(bakes them), and **admin** (a trusted operator who can see and manage
everything). When you sign up, you can only choose requester or baker — **admin
is never self-selectable**, on purpose. The server refuses any attempt to sign
yourself up as an admin, so the very first admin has to be set by hand in the
database. Here's how:

1. **Sign up normally** in the app with your email — pick requester or baker,
   it doesn't matter which.
2. In **Supabase**, open **SQL Editor** and run this one command, with **your**
   email in the quotes:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. Back in the app, **sign out and sign in again**. You're now an admin: the
   **Admin** link appears in the nav, and the admin view lets you release any
   reservation and delete any request (including the legacy anonymous ones).

After that first one, an admin could promote others the same way. (A proper
"promote to admin" button for admins is a later slice — for now it's this SQL.)

## Security backstop — Row-Level Security (RLS)

The real gatekeeper is the **Express server**: it verifies your login, looks up
your role, and decides every "may this person do this?" question (with a full
negative-test suite proving it says no to missing tokens, wrong roles, and
acting on someone else's request). RLS is a **second wall behind that** — a rule
in the database itself.

The browser never talks to the `cake_requests` or `profiles` tables directly
(it only uses Supabase for logging in); all data goes through our server, which
holds the **secret service key** that is allowed past RLS. So we lock the tables
down to server-only access. If the publishable key ever leaked, nobody could
read or change requests straight from the database — they'd still have to go
through the server, where the real rules live.

To turn this backstop on, run once in Supabase → SQL Editor:

```sql
-- Only our server (with the secret service key) may touch cake_requests.
-- The browser never queries this table directly, so nothing in the app breaks.
alter table public.cake_requests enable row level security;
```

(The `profiles` table was already locked down this way back in Phase 1.)

## Finished-cake photos (Storage)

When a baker marks a cake delivered they can attach one photo. Photos live in a
**private** Supabase Storage bucket called **`cake-photos`** — created once in
the dashboard (Storage → New bucket → name `cake-photos`, **Public: off**). No
storage policies are needed: only our server touches Storage (with the secret
service key, which bypasses the private-bucket lock), and it hands an authorized
viewer — the requester, the baker, or an admin — a short-lived signed link to
view the image. The browser never uploads to Storage directly.

## Where things stand right now

The core app is **built and working**, through Slice 6 plus several Slice 7
extras. What the app does today:

- **Requesters** sign up, post cake requests (with a contact phone), and track
  their own requests through to completion.
- **Bakers** sign up, get **verified by an admin**, browse open requests, and
  reserve one → **"I'll bake this"** (which emails them the request details:
  location + the requester's phone) → **mark it delivered** (optionally with a
  private photo).
- **Requesters** then **confirm received**, closing the loop.
- **Both** can opt a finished cake into a public **inspiration gallery** (with a
  caption); it appears only when both agree.
- **Admins** get a **dashboard**, verify bakers, remove photos, see a
  **"needs attention"** list of stuck requests, and can manage anything.
- Everything is **bilingual (English + Hebrew, RTL)** and each cake shows a
  **journey timeline**.

## The roadmap — status

| # | Slice | Status |
|---|-------|--------|
| 1 | Request form + open list | ✅ Done |
| 1.5 | Language toggle (EN / עברית) | ✅ Done |
| 2 | Make it remember (backend + DB) | ✅ Done |
| 3 | Baker browse & reserve | ✅ Done |
| 4 | Accounts / logging in (+ RLS hardening) | ✅ Done |
| 5 | Fulfillment flow (commit → deliver → receive, photos) | ✅ Done |
| 6 | Admin tools (verify bakers, moderate photos, needs-attention) | ✅ Done |
| 7 | Magic touches | 🔵 In progress — done: stats dashboard, Compassion Timeline, baker email on commit, public gallery. Not yet: AI tagging (needs a paid LLM key), notify-nearby-bakers |

Full detail for each slice is in the design doc and the per-slice specs under
`docs/superpowers/specs/`.

---

## Running it locally (two servers)

The app is **two programs that both need to run**:

- **Backend** (Express API): `npm --prefix server run dev` → http://localhost:3001
- **Frontend** (Vite): `npm run dev` → http://localhost:5173

Open the frontend URL. If the page says "could not reach the server," the
backend isn't running.

## One-time setup (env + database)

- **Frontend `.env`** (git-ignored): `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` (the publishable key). See `.env.example`.
- **`server/.env`** (git-ignored): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  (the **secret** key), `PORT`, and optionally `RESEND_API_KEY` / `EMAIL_FROM`
  for baker emails. See `server/.env.example`.
- **Supabase database** — the live database is the source of truth; it was built
  up column-by-column as slices landed. In order, the schema gained: the
  `profiles` table (`role`, `display_name`, `contact`, `verified_at`) with an
  on-signup trigger; and on `cake_requests` the columns `owner_id`,
  `reserved_by`/`reserved_contact`/`reserved_by_user_id`/`reserved_at`,
  `committed_at`/`delivered_at`/`received_at`, `photo_path`, `contact_phone`, and
  `shared_by_owner`/`shared_by_baker`/`gallery_caption`. Plus **RLS enabled** on
  both tables (see above) and a private **`cake-photos`** Storage bucket.

---

## The reference project

`pocket-pt` (in `C:\Users\PC\pocket-pt`) is a separate, unrelated project that
uses the **same tech stack**. When unsure how to structure something here,
look at how pocket-pt does it — it's a working example to copy patterns from.
