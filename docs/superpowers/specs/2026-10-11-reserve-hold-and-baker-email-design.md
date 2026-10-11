# Reserve hold box + baker email (design)

*Written 2026-10-11. Replaces the reserve/commit parts of
`2026-08-25-slice-baker-browse-reserve-design.md` and
`2026-08-25-slice-5-fulfillment-design.md` (see "Superseded" at the end).*

## Goal

A baker browsing open requests can **hold** a cake for one hour, then either
**let it go** or **commit to baking it**. Committing sends the baker an email
with everything they need to arrange delivery, including the recipient's phone.

## What the user asked for (and what was already built)

Already in the app: every open request is visible to every baker; a 1-hour hold
that expires on its own (computed on read, no background job); release; commit.

New in this spec:

1. The open-request card shows **which organization posted** it, plus the
   **area, dietary needs, kashrut and occasion** — and **no recipient name and
   no phone number** (not even a first name) until the baker commits.
2. The button reads **"Reserve this cake"** with a line under it:
   *"Reserving lets you hold it for 1 hour."*
3. Pressing it holds the cake and opens a **hold box** with a 1-hour countdown
   and two choices:
   - **Not this time** — releases the cake immediately.
   - **I'll bake it** — commits, then opens the **thank-you box**.
   If nothing is chosen the hold expires and the cake returns to Open (existing
   behaviour). Closing the box does not release the cake; the baker can reopen
   it from "My reservations" while the hold runs.
4. The **thank-you box** thanks the baker and tells them to check their email.
5. An **email** goes to the baker's sign-up address on commit.
6. The request form's phone field is the **recipient's** phone, and that exact
   number is the one emailed.

## Decisions (confirmed with the user)

- Email contents: **recipient's full name + phone**, and **cake details**
  (occasion, needed-by date, location, dietary needs, kashrut, note about the
  recipient). **Not** included: posting organization's name, link to the app.
- The phone and full name also stay on the card in the app after commit, as a
  fallback when an email is delayed or lost.
- Approach A: the server sends the email directly when the commit succeeds.
  The commit never fails because an email failed. A "send it again" button on
  the committed card re-sends. (Rejected: a queue + background worker, which is
  more machinery than this app needs.)
- Email provider: **Resend**. Whether `bakethecake.org` is verified there is
  **unknown**; the plan includes a manual check step for the user. Until it is
  verified Resend only delivers to the account owner, so the email half cannot
  be tested with real bakers before then.

## Design

### Cards
What a baker sees on an open request: organization, area, dietary needs,
kashrut, occasion (and the existing needed-by date and short note preview).
The recipient's name — including today's "first name only" preview — and the
phone are removed from browse cards for everyone except the owner, admins and
the committed baker. (Today `redactReserver` keeps the first name; that changes.)

`GET /api/requests` adds `organizationName` (the poster's organization name) to
every request. It is public to all viewers (bakers, admins, signed-out), as
requested. Legacy rows with no owner show no organization line.

**Open question for the plan (needs a read of the live DB):** where the
organization name is stored. The `redeem_invite_code` database function takes
`p_org_name`; the plan must read its definition in Supabase and use whichever
column it writes (expected: `profiles.display_name`). If it is not stored
anywhere retrievable, one small additive migration (a user-run SQL step) is
needed.

### Hold box
- A modal opened right after a successful reserve call, and reopenable from
  "My reservations" while `status === 'reserved'` and the hold is active.
- Countdown from `reservedUntil` (server time is the source of truth; the
  client clock only renders it). At zero the box closes itself and the card
  falls back to Open on the next refresh.
- "Not this time" calls the existing release endpoint. "I'll bake it" calls the
  existing commit endpoint, then opens the thank-you box.
- All new strings go in both `en.ts` and `he.ts` and the `Dictionary` type.

### Privacy tightening (behaviour change)
Today a baker who merely reserves already receives the recipient's full name
and phone (`redactReserver` treats the holder like the owner). The code comment
says these are private "until a baker commits". Change it: while status is
`reserved`, the holder sees the same redacted card as any baker (no name at all,
no phone, short note preview). Full name, phone and full note are
released only when status is `committed` (or later), to the committing baker,
the owner and admins. This replaces the current "first name only" preview with no name at all. The
email is sent after commit, so it never leaks
anything the commit did not already unlock.

### Request form phone field
- English label becomes **"Recipient's phone"**, hint *"The baker will use this
  number to arrange delivery."* (Hebrew already says "phone of the cake
  recipient"; keep it and align the hint.)
- The value saved as `contactPhone` is the value emailed. No second field.
- Existing validation (Israeli/international format) is unchanged.

### Email
- New `server/src/emailer.ts` behind a small interface (`sendCommitEmail`),
  with a fake implementation for tests, matching how other stores are injected.
- Sent from the commit handler after the database update succeeds. Failure is
  logged and reported to the client as `emailSent: false`; the thank-you box
  then says the email did not go out and offers "send it again" and shows the
  details in the app.
- Recipient address: the baker's auth email (`profile.email`, already on the
  authenticated profile).
- Sender address, API key (`RESEND_API_KEY`) and sender (`EMAIL_FROM`) come from
  environment variables on Render. No secrets in the repo.
- Resend is called with an idempotency key of the request id + commit time, so
  a retried commit cannot send twice.
- "Send it again": `POST /api/requests/:id/resend-details`, baker-holder or
  admin only, only while committed, rate-limited per request.
- Email text is plain, in the baker's current language preference (Hebrew or
  English), and written to read like a person, not a template.

### Data flow
1. Baker presses **Reserve this cake** → `POST /api/requests/:id/reserve`
   (existing) → hold box opens.
2. **Not this time** → `POST /api/requests/:id/release` (existing).
3. **I'll bake it** → `POST /api/requests/:id/commit` (existing, extended) →
   server updates, sends email, returns the unredacted request + `emailSent`.
4. Thank-you box → "check your email".

### Errors and edge cases
- Two bakers press Reserve at once: existing `ALREADY_RESERVED` 409; the second
  baker sees "someone just reserved this cake" and the card refreshes.
- Hold expires while the box is open: box closes, message "the hour ran out, the
  cake is open again". A late commit returns the existing 409.
- Baker without a verified account: unchanged (cannot reserve; sees the pending
  note).
- Baker signed up with no email on the auth user: not possible with email
  sign-up, but if `profile.email` is null the commit still succeeds and the
  thank-you box shows the details in the app.

### Testing
- Server: privacy redaction during `reserved` vs `committed`; commit sends
  exactly one email via the fake emailer and survives emailer failure;
  resend endpoint authorization and rate limit; `organizationName` present for
  all viewers.
- Client: hold box countdown, both buttons, expiry close, thank-you box states
  (sent / not sent); form label.
- Manual: after Resend domain verification, one real end-to-end commit.

## Out of scope
Queues / background workers, SMS or WhatsApp, a link back to the app inside the
email, showing the organization's name in the email, changing who can post.

## Superseded
The old reserve form that asked the baker for a name + contact, and the
inline "release / I want to bake this cake" buttons, are replaced by the hold
box. The 1-hour hold, computed expiry and the commit/deliver/receive lifecycle
are unchanged.
