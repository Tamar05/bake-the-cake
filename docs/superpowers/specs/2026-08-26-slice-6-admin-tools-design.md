# Slice 6 — Admin tools (design)

*Written 2026-08-26. The roadmap's Slice 6: give admins the three powers they
need to run the service — verify bakers, moderate photos, and help stuck
requests. Reuses the existing React → Express → Supabase pieces.*

---

## Goal

Turn "admin" from a role that can *see* everything into one that can *run* the
service: decide which bakers are trusted, take down a bad photo, and spot cakes
that are falling through the cracks.

## Decisions (chosen this session)

- **Verification is a hard gate:** an unverified baker can browse but **cannot
  reserve or bake** until an admin verifies them. (Not a soft badge.)
- **Photo moderation is simple removal:** an admin can delete any photo. (Not a
  pending/approved review queue.)
- **Stuck requests are surfaced, not automated:** a "Needs attention" admin view
  lists them with the requester's contact. (Automatic outreach is Slice 7.)

## Phase 1 — Verify bakers

**Data:** add `verified_at timestamptz` to `profiles` (null = unverified). New
bakers start unverified. Requesters and admins are unaffected by it (admins are
trusted by definition; requesters don't bake).

**Server:**
- The verified state rides on the authenticated profile: the authenticator reads
  `verified_at` and exposes `verified: boolean` on `AuthedProfile`.
- **Reserve is gated:** only a **verified** baker (or an admin) may reserve. An
  unverified baker gets 403. Gating reserve is enough — no reservation means no
  commit/deliver either.
- A small **profiles store** (new, injected like the requests store): `listBakers()`
  and `setVerified(id, verified)`.
- New admin-only endpoints: `GET /api/bakers` (list bakers + verified flag) and
  `POST /api/bakers/:id/verification` with `{ verified: boolean }` (set/clear
  `verified_at`).

**Frontend:**
- `Profile`/`/api/me` gain `verified`. `AuthProvider` carries it.
- The Reserve button shows only for a **verified** baker or an admin. An
  unverified baker sees a "your account is pending verification" note where the
  reserve action would be.
- A new **admin "Bakers" screen** (`/admin/bakers`): every baker with their
  verified state and a **Verify / Unverify** toggle. Admin-nav gains the link.

**Setup (user):** `alter table public.profiles add column verified_at timestamptz;`
then verify your own baker account once (via the new screen, as admin) to keep
single-account testing working.

## Phase 2 — Moderate photos

**Server:** `DELETE /api/requests/:id/photo` (admin only) — removes the file from
the private `cake-photos` bucket and clears `photo_path` on the row. Store gains
`removePhoto(id)`.

**Frontend:** on the admin view, a card that has a photo shows a **"Remove
photo"** button (with a confirm). On success the photo disappears (`hasPhoto`
false).

## Phase 3 — "Needs attention" view

**What counts as stuck (computed, no new column):**
- **Unclaimed too long:** status `open` and created more than **7 days** ago.
- **Overdue:** `neededBy` date is in the past and the cake isn't `delivered`/`received`.

**Server:** admin viewers get the **requester's contact** on each request so they
can reach out. Add `ownerContact: string | null`, filled by the server **only for
admin viewers** (looked up from `profiles.contact`), null for everyone else.

**Frontend:** a new **admin "Needs attention" screen** (`/admin/attention`)
listing the stuck cakes, each showing why it's flagged (unclaimed N days /
overdue) and the requester's contact. Admin-nav gains the link.

## Security / rigor

Every new admin power is `requireRole('admin')` and server-enforced, with negative
tests (no token → 401, non-admin → 403). The verified gate on reserve gets tests
(unverified baker → 403, verified baker → 200, admin → 200). `ownerContact` is
only ever populated for admin viewers (a privacy check, tested).

## Deliberately NOT in this slice

Automatic notifications/outreach and the stats dashboard (Slice 7); a full photo
approval queue; letting bakers re-upload/replace their own photo.
