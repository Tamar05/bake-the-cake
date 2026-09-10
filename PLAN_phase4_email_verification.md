# Phase 4 — Baker sign-up: email confirmation replaces admin verification

## Goal
A baker becomes "verified" (able to reserve/bake) automatically once they confirm their email,
instead of waiting for an admin to manually approve them. The admin's existing Verify Bakers
screen stays, repurposed as a suspend/reinstate tool rather than the sign-up gate.

## Current state (verified in code)
- `profiles.verified_at` (timestamptz, nullable) is the sole verification signal — set only by
  an admin via `POST /api/bakers/:id/verification` → `profilesStore.setVerified`.
- `server/src/auth.ts` `requireVerifiedBaker` and `AuthedProfile.verified` derive straight from
  `verified_at != null`; `RequestCard.tsx` gates the Reserve button the same way client-side.
- Supabase's "Confirm email" project setting is (per the user) currently OFF — sign-up returns a
  session immediately, and `email_confirmed_at` on `auth.users` may already be set for existing
  accounts regardless (Supabase can populate it even with confirmation off).
- `AuthProvider.signUp` / `AuthPanel.tsx` / `JoinPage.tsx` all assume `signUp` returns a session
  synchronously — they save baker capabilities and (JoinPage) redeem an invite code using that
  session's token right after sign-up.

## Design: a DB trigger auto-verifies; a separate column carries admin suspension
A first draft of this plan tried to reuse `verified_at`'s nullability for BOTH "never verified"
and "admin suspended" — an auth review caught that this is unsafe: nothing distinguishes the two
states, so if anything ever re-confirms an email that was already confirmed (Supabase resending a
confirmation link, a future `auth.admin.updateUserById(..., { email_confirm: false })` call, a
manual toggle in Supabase Studio), the trigger would silently **un-suspend** a baker an admin
deliberately blocked, with no audit trail. Fixed by giving suspension its own column:

- `profiles.verified_at` — set once, automatically, the first time a baker's email is confirmed
  (by the trigger) OR manually by an admin. Never cleared automatically. Monotonic: once set,
  stays set.
- `profiles.suspended_at` (new) — admin-only, hand-set. When present, the baker cannot reserve or
  bake regardless of `verified_at`. This is what the Verify Bakers screen's toggle now controls.
- The gate becomes: **verified = `verified_at is not null AND suspended_at is null`.**

```sql
alter table profiles add column if not exists suspended_at timestamptz;

create or replace function verify_baker_on_email_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update profiles
    set verified_at = coalesce(verified_at, now())
    where id = new.id and role = 'baker';
  end if;
  return new;
end;
$$;

drop trigger if exists on_email_confirmed on auth.users;
create trigger on_email_confirmed
  after update on auth.users
  for each row
  execute function verify_baker_on_email_confirm();
```

Why this holds up under the re-fire scenario the review raised: the trigger only ever *sets*
`verified_at` (via `coalesce`, so it's a no-op if already set) — it never touches `suspended_at`.
An admin suspension is therefore untouchable by anything email-confirmation-related, no matter how
many times `email_confirmed_at` flips. Reinstating a suspended baker is a distinct admin action
that clears `suspended_at`; it does not depend on or interact with the trigger at all.

- **No retroactive effect on existing accounts.** The trigger only fires on a *future* UPDATE
  transition of `email_confirmed_at`. An account whose value is already set (from before this
  ships) never re-fires it, so existing accounts are untouched by this migration — matching the
  plan's requirement that today's pending bakers get cleared by hand, not auto-verified.
- **One-time manual step for the user, before flipping the Supabase setting**: go through the
  current Verify Bakers screen and verify (or leave unverified) every baker pending today.

### Server/client changes this still requires (unlike the earlier zero-code-change draft)
- `server/src/auth.ts` — `AuthedProfile.verified` changes from `verified_at != null` to
  `verified_at != null && suspended_at == null`; the Supabase authenticator's profile select adds
  `suspended_at`.
- `server/src/profilesStore.ts` — `listBakers`/`setVerified` select `suspended_at` too;
  `setVerified(id, false)` ("unverify" in today's UI) now writes `suspended_at = now()` instead of
  clearing `verified_at`; `setVerified(id, true)` ("verify"/reinstate) clears `suspended_at` AND
  sets `verified_at = coalesce(verified_at, now())` — preserving the admin's existing power to
  manually verify someone immediately, without waiting on email confirmation.
- `AdminBakersPage.tsx` / the `bakers` dictionary keys — unchanged in shape (still one boolean,
  still one toggle); only the server-side meaning of "false" moves from "never verified" to
  "explicitly suspended."

## Changes needed in this repo
Only the sign-up flow's assumption that `signUp` always returns an immediate session breaks once
"Confirm email" is turned on — Supabase then returns `{ user, session: null }` and sends a
confirmation email instead. Both sign-up paths need a real "check your email" state instead of
silently doing nothing:

- `AuthProvider.tsx`: `signUp` returns `{ emailConfirmationRequired: boolean }` instead of
  `void`, so callers know whether they got a session.
- `AuthPanel.tsx`: on `emailConfirmationRequired`, show a persistent message ("Check your email to
  confirm your account, then sign in") instead of leaving the form sitting there with no feedback.
- `JoinPage.tsx` — this is the real behavior change: **an organization signing up via /join can no
  longer redeem their code in the same action** when there's no session yet. New flow: sign up →
  see "check your email, then sign in and come back here" → they sign in later → land back on
  /join **already signed in as a (confirmed) baker** → the existing `alreadySignedIn` branch
  (code + org name only) handles the rest unchanged.
- `list.ts` dictionary's `pendingVerification` copy ("awaiting verification") stays accurate as-is
  — a baker who hasn't confirmed their email is, correctly, still unverified — no copy change
  needed there.

## Explicitly out of scope
- No changes to `requireVerifiedBaker` itself, `AdminBakersPage.tsx`'s UI, or the `bakers`
  dictionary keys — only what feeds the `verified` boolean changes (see above).
- No changes to the invite-code redemption logic itself (Phase 1) — only how a signed-out visitor
  reaches the point of having a session to redeem with.

## Open items needing the user, before/alongside shipping this
1. **Turn on "Confirm email"** in Supabase → Authentication → Providers → Email (off today).
2. **Run the trigger SQL above**, and the one-time manual review of today's pending bakers in the
   existing Verify Bakers screen, ideally *before* flipping the setting so nothing is mid-flight.
3. **Email deliverability**: Supabase's built-in email sending has a low default rate limit,
   meant for testing, not production sign-up volume — worth checking whether a custom SMTP
   provider should be configured so confirmation emails actually arrive reliably. Flagging this
   as a decision for the user, not assuming an answer.

## Risk / auth-review checklist (touches sign-up + verification, full check)
- [ ] The trigger only ever sets `verified_at` (via `coalesce`, so re-firing is a no-op) for
      `role = 'baker'` rows — never touches `suspended_at`, never clears anything.
- [ ] No new client-trusted input affects verification; the whole mechanism is
      Supabase-authenticated-email-confirmed → DB trigger, with no client-supplied flag anywhere
      in the path.
- [ ] Admin suspend/reinstate remains admin-only (`requireRole('admin')`, unchanged) and is now
      immune to anything email-confirmation-related re-firing (the fix for the finding above).
- [ ] Confirm the trigger is idempotent / safe to `create or replace` if re-run.
- [ ] **Stated dependency (flagged by review, not a code fix — just documenting it):** the
      JoinPage flow's safety ("nobody redeems an invite code without a confirmed email") holds
      only because Supabase currently refuses to issue a session for an unconfirmed account. If
      that ever changes (a different auth method, a Supabase settings change), this flow's
      implicit guarantee breaks silently. Noted here so a future change to auth settings prompts
      a re-check of this file, not just an assumption that /join is still safe.
