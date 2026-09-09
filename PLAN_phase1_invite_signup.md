# Phase 1 — Invite-gated organization ("requester") sign-up

## Goal
Stop letting the public sign-up form self-assign the "requester" (organization/receiver) role.
From now on, public sign-up always creates a `baker` account. Becoming a `requester` requires
redeeming a valid invite code on a separate `/join` page. Admins manage those codes.

## Current state (verified in code)
- `SignUpRole = 'requester' | 'baker'` (client) — client sends the chosen role straight to
  Supabase in `auth.signUp({ options: { data: { role, ... } } })`.
- A DB trigger (not in this repo as a migration file — the user has been running ad-hoc SQL,
  per project memory) reads `raw_user_meta_data.role` to set `profiles.role` on insert. This is
  the actual trust hole: the client fully controls that value today.
- `server/src/auth.ts` — `requireRole(...)` / `requireVerifiedBaker` already gate server routes
  by `profiles.role`; nothing there needs to change, only how `role` gets *set*.
- No `org_name` concept exists yet anywhere (profiles or requests) — a requester's own
  `display_name` is what's shown today.
- No `invite_codes` table exists.

## Changes

### 1. Database (SQL the user runs by hand, per this project's convention)
```sql
create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  note text, -- e.g. which organization this was issued for; admin-facing only
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table profiles add column if not exists org_name text;

-- Atomic redeem: flips a plain baker to requester + sets org_name, but only
-- when a matching, unrevoked code exists — checked and applied in one
-- statement so a concurrent revoke can't race past it, and only a current
-- 'baker' can redeem (blocks an existing requester/admin from "rejoining").
-- security definer: the server always calls this with the service-role key,
-- but definer mode keeps it safe even if that ever changes.
create or replace function redeem_invite_code(p_code text, p_profile_id uuid, p_org_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update profiles
    set role = 'requester', org_name = p_org_name
    where id = p_profile_id
      and role = 'baker'
      and exists (
        select 1 from invite_codes where code = p_code and revoked_at is null
      )
    returning id
  )
  select exists (select 1 from updated);
$$;
```
- RLS: `invite_codes` is service-role-only (server always uses the service-role key here, same
  pattern as the rest of this app) — no client-side Supabase calls touch it directly, so no new
  RLS policy is strictly required, but we still lock it down (`enable row level security` +
  no policies) so a future direct-client read can't leak codes.
- **Resolved — the signup trigger.** Confirmed via the user: `profiles.role` is set by a
  Postgres trigger on `auth.users` whose insert currently reads:
  `case when new.raw_user_meta_data ->> 'role' = 'baker' then 'baker' else 'requester' end`
  — meaning *anything other than an explicit `'baker'`* (including nothing at all) already
  defaulted to `requester`, independent of the client's dropdown. **User action (done
  independently of the rest of this phase, applied directly in Supabase):** replace that
  expression with a hardcoded `'baker'`, so every signup becomes a `baker` regardless of what's
  sent. This is the actual enforcement point; everything below builds the controlled path
  (`/api/join`) that's now the only way to become a `requester`.

### 2. Server (`server/src/`)
- New `invitesStore.ts` (mirrors `profilesStore.ts` shape): `redeemCode(code, profileId, orgName)`
  performs the check-and-flip as a **single Postgres update**, not a read then a write —
  `update invite_codes set ... ` isn't right either; the actual query is on `profiles`, guarded
  by an `exists` subquery against `invite_codes` in the same statement:
  ```sql
  update profiles
  set role = 'requester', org_name = $orgName
  where id = $profileId
    and role = 'baker'  -- self-demotion guard: only a plain baker can redeem (see below)
    and exists (
      select 1 from invite_codes
      where code = $code and revoked_at is null
    )
  returning id;
  ```
  Zero rows back means "invalid" — the route treats *every* zero-row case (bad code, revoked
  code, or caller already non-baker) the same way, see below. This closes the revoke-race gap:
  the code's validity is checked in the same statement that flips the role, so a revoke that
  commits first is guaranteed to block the redemption.
  `listCodes()`, `createCode(note)`, `revokeCode(id)` for the admin screen.
- **Self-demotion guard**: redemption only succeeds when the caller's current role is `baker`
  (enforced in the query above). An existing `requester` or `admin` calling `/api/join` gets the
  same generic failure as a bad code — never silently flips their own privileged role.
- **Generic error, no enumeration**: `/api/join` returns one identical message (e.g. "That code
  isn't valid.") for bad code, revoked code, and wrong-caller-role — never distinguishes which,
  so a signed-in user can't probe which codes exist or are still active.
- **Input limits**: `orgName` and the admin-side `note` are trimmed and capped (e.g. 80 chars),
  rejected if empty after trimming — `org_name` is shown publicly per Phase 3, so it goes
  through the same plain-text handling as other user-facing fields already in this app (no HTML,
  React escapes on render).
- **Rate limiting**: `/api/join` requires an existing authenticated session (created via normal
  sign-up first), so brute-forcing needs a real, signed-up account per burst — the existing
  Supabase sign-up flow is the natural throttle. Given this app's scale (a handful of admins
  issuing codes to known organizations), a per-IP/per-user attempt counter is a nice-to-have,
  not a blocker for Phase 1; note it as a follow-up rather than building it now.
- New routes in `app.ts`:
  - `POST /api/join` — `auth` required (the account must already exist — sign-up happens first
    via the normal endpoint, then this call redeems the code), body `{ code, orgName }`. On
    success, updates the caller's own profile only (never someone else's id — take it from
    `req.auth`, not the body). On failure, the generic message above with a 400.
  - `GET /api/admin/invite-codes`, `POST /api/admin/invite-codes`,
    `POST /api/admin/invite-codes/:id/revoke` — all `requireRole('admin')`, matching the
    existing `/api/bakers` admin pattern.
- `auth.ts` needs no change — `requireRole`/`requireVerifiedBaker` already read `profiles.role`.

### 3. Client (`src/`)
- `AuthPanel.tsx` — remove the role `<select>` entirely from the public sign-up form; sign-up
  always calls `signUp(...)` without a role (or the client can still pass `'baker'` — it no
  longer matters since the server-side trigger ignores it, but sending `'baker'` keeps the
  type honest instead of a role the client can't actually grant).
- New `src/pages/JoinPage.tsx` + route `/join`: email/password/display-name fields (reuses the
  same validation helpers as `AuthPanel` — `isStrongPassword`, contact validation) plus
  `code` and `orgName` fields. Flow: call the existing sign-up path to create the account, then
  `POST /api/join` with the code once signed in; on a bad code, show the error and let them
  retry the code (account already exists — don't re-signup).
- New `src/pages/AdminInviteCodes.tsx` (admin-only route, alongside the existing Verify Bakers /
  Needs Attention admin screens): list codes (with note, created date, revoked state), a
  "create code" form (just a note field — the code itself is generated server-side, e.g. 8
  random alphanumeric chars), and a revoke button per code.
- `AppNav.tsx` — add a "Join as an organization" link near sign-in for logged-out visitors, and
  an admin nav entry for the new invite-codes screen (same pattern as the existing admin links).

## Explicitly out of scope for Phase 1
- No changes to the request form, matching, or visibility (that's Phases 2/3/5).
- No changes to baker verification (that's Phase 4).
- Existing accounts (already-`requester` or already-`baker`) are untouched by this migration —
  the `org_name` column is simply null for pre-existing requesters until they set one (a later
  "edit org name" affordance is a nice-to-have, not required for Phase 1).

## Risk / auth-review checklist (this touches sign-up, so it gets the full check)
- [ ] Role is set **only** server-side (trigger + `/api/join`), never trusted from client body.
- [ ] `/api/join` mutates only `req.auth`'s own profile id — never an id from the request body.
- [ ] Invite codes are single-use-optional-but-tracked: reusable by design (per the brainstorm),
      so redemption does NOT delete/expire the code — only `revoked_at` stops it. Confirm this
      is the intended tradeoff (a leaked code stays valid for anyone until an admin revokes it).
- [ ] Admin invite-code routes are `requireRole('admin')`, matching existing admin routes.
- [ ] No secret/code value is ever logged.
