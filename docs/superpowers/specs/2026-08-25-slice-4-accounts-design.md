# Slice 4 — Accounts / logging in (design)

*Written 2026-08-25. The roadmap's "grown-up app" jump. Chosen scope: **full
role-based accounts** (requester / baker / admin). Sign-in method: **email +
password** via Supabase Auth.*

---

## Goal

Turn the app from "anyone can do anything" into "you sign in, and what you see
and can do depends on who you are":

- **Requester** — signs up, posts cake requests, sees their own requests + status.
- **Baker** — signs up, browses open requests, reserves/bakes them.
- **Admin** — a trusted operator who can see and manage everything (verify bakers
  and moderation come in Slice 6; this slice just establishes the role + power).

## Security spine (from the security protocols)

This is the security-critical slice, so the rules are load-bearing:

- **The server is the gatekeeper.** The browser logs in with Supabase Auth and
  gets a token; it sends that token to our Express server on every call. The
  server **verifies the token** and **looks up the person's role in the database**
  — it never trusts a role or user-id sent from the browser.
- **Authorize every action, fail closed.** Each endpoint checks "may *this* person
  do *this* to *this* request?" (owner-or-admin to edit/delete; baker to reserve;
  the reserving baker or admin to release). Unknown or missing → denied (401/403).
- Passwords are handled by Supabase Auth (properly hashed) — we never store them.
- **Admin is not self-selectable.** Sign-up only offers requester/baker; the
  server refuses any attempt to self-assign admin. The first admin is set by hand
  in the database.
- Row-level security (a database-level backstop) and an auth negative-test suite
  are the hardening phase — noted, done at the end.

## Data changes (Supabase)

- **New `profiles` table:** `id` (= the auth user id), `display_name`, `role`
  (`requester` | `baker` | `admin`), `contact` (bakers' phone/email, reused when
  they reserve), `created_at`. A profile row is created when someone signs up.
- **`cake_requests` gains `owner_id`** (the requester who posted it; null for the
  3 legacy anonymous rows) **and `reserved_by_user_id`** (the baker who reserved).
  The existing `reserved_by` / `reserved_contact` stay as display fields, now
  filled from the baker's profile instead of typed.

## What changes in what we already built

- **The reserve form goes away for logged-in bakers.** Today a baker types a name
  + contact to reserve. With accounts, those come from their profile, so reserving
  becomes a single click. (Expected — the roadmap always meant accounts to replace
  the typed-in identity.)
- The request form becomes requester-only; the reserve button becomes baker-only.

## Decisions defaulted (say if you'd rather change one)

- **One role per account** for now (you're a requester *or* a baker, not both).
  Simpler to learn; we can allow both later.
- **Legacy anonymous requests** (the current 3) stay visible and reservable; only
  an admin can edit/delete them since nobody owns them.
- **Architecture unchanged** — React → Express → Supabase, server holds the
  service key and enforces the rules. RLS is added as a backstop at the end, not
  as the primary gate.

## Setup you'll do (external, like before)

1. Run SQL in Supabase to create `profiles` and add the two `cake_requests`
   columns (I'll give you the exact SQL when we start).
2. Put the Supabase **publishable/anon key** into the frontend `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) — the browser needs it to log
   in. (The secret key stays server-only, as now.)
3. After you make your own account, promote it to admin once by hand in Supabase.

## Phased build (each phase ends with something visible)

1. **Sign up / log in / log out.** Supabase Auth wired in; sign-up (email,
   password, name, requester-or-baker) + login + logout; the header shows
   "Signed in as … (role)". Server gets an auth check + a `/api/me` endpoint.
2. **Requests belong to their owner.** New requests carry `owner_id`; the request
   form is requester-only; server enforces create/edit/delete permission.
3. **Baker reserve via account.** One-click reserve for bakers (identity from
   profile); only the reserving baker or admin can release.
4. **Role-based views + admin.** Each role lands on its own view; admin can manage
   anything. Document how the first admin is bootstrapped.
5. **Hardening.** RLS policies as a database backstop + auth negative tests
   (no token → 401, wrong role → 403, acting on someone else's request → 403).

## Deliberately NOT in this slice

Baker verification, photo moderation, notifications, password reset emails, MFA
(all later/hardening). Password reset + MFA are worth adding before real users.
