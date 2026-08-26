# Bake the Cake 🍰

A charity web app that connects people who need a celebration cake with
volunteer bakers who make one for free. Same tech stack as the pocket-pt
project (React + TypeScript + Vite frontend, Express backend, Supabase database).

---

## 👉 START HERE — how to continue building

This project is built **one small slice at a time**. The full plan (vision,
tech stack, and the step-by-step roadmap) lives here:

**`docs/superpowers/specs/2026-08-20-bake-the-cake-design.md`**

Read that first. Then, to pick up work with Claude Code:

1. Open this `bake-the-cake` folder in VS Code (you're likely here already).
2. Trust the folder if VS Code asks (dismiss "Restricted Mode").
3. Open Claude Code **in this window** and start a new conversation.
4. Paste this to Claude to get going:

   > Read `docs/superpowers/specs/2026-08-20-bake-the-cake-design.md`.
   > It's the plan for this project. Let's build Slice 1 — the cake request
   > form and the list of open requests. I'm new to coding, so explain each
   > step in plain English and keep changes small.

That single message gives a fresh Claude Code everything it needs — it reads
the plan and continues exactly where we left off.

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

- ✅ Project folder created, separate from pocket-pt, with its own git history.
- ✅ Full design + roadmap written (the doc linked above).
- ✅ Language plan decided: **English + Hebrew**, built in from the start
  (Hebrew reads right-to-left, so the layout flips).
- ⬜ **Slice 1 not started yet** — that's the next thing to build.

The current files (`index.html`, `styles.css`, `script.js`) are a temporary
plain-HTML placeholder — a "prove the folder works" pink cake page. They get
**replaced** by the proper React setup when Slice 1 begins. Nothing important
is lost.

---

## The roadmap at a glance

| # | Slice | What you get |
|---|-------|--------------|
| 1 | Request form + open list | Fill a cake request, see it listed |
| 1.5 | Language toggle (EN / עברית) | Switch languages; layout flips for Hebrew |
| 2 | Make it remember | Requests stay saved (adds backend + database) |
| 3 | Baker browse & reserve | Bakers claim requests |
| 4 | Accounts / logging in | Sign in as requester, baker, or admin |
| 5 | Fulfillment flow | Photos, mark delivered, confirm received |
| 6 | Admin tools | Verify bakers, moderate photos, outreach |
| 7 | Magic touches | AI tagging, matching, gallery, stats dashboard |

Full detail for each slice is in the design doc.

---

## The reference project

`pocket-pt` (in `C:\Users\PC\pocket-pt`) is a separate, unrelated project that
uses the **same tech stack**. When unsure how to structure something here,
look at how pocket-pt does it — it's a working example to copy patterns from.
