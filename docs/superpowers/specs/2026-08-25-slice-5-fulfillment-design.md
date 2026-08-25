# Slice 5 — Fulfillment flow (design)

*Written 2026-08-25. The roadmap's Slice 5: a baker commits to bake a reserved
cake, marks it delivered (optionally with a photo), and the requester confirms
they received it. Introduces file storage (Supabase Storage).*

---

## Goal

Carry a cake all the way from "a baker grabbed it" to "the requester got it,"
with a clear, visible state at every step and a private finished-cake photo.

## The lifecycle

A request's `status` becomes a chain, each step a deliberate action:

```
open → reserved (1-hr hold) → committed → delivered → received
```

- **reserved** — unchanged from Slice 3: a baker's 1-hour auto-expiring hold.
- **committed** — the baker presses **"I'll bake this"** while holding it. The
  claim becomes durable: the 1-hour countdown no longer applies; the cake stays
  theirs until they deliver or release it.
- **delivered** — the baker presses **"Mark delivered."** A single finished-cake
  photo may be attached, but it is **optional** — delivered works without one.
- **received** — the **requester who owns it** presses **"Confirm received,"**
  closing the loop. (Legacy anonymous rows have no owner, so an admin confirms.)

Status is **derived on read** (like the current reservation clock), newest state
winning: `received_at` → received, else `delivered_at` → delivered, else
`committed_at` → committed, else an active `reserved_at` hold → reserved, else
open. Once `committed_at` is set the 1-hour expiry is ignored.

## Decisions (chosen this session)

- **Commit step** (not "reserving = committing"): keep the quick 1-hour hold, add
  a separate "I'll bake this" that makes it durable. Two shades of claimed.
- **One photo, optional**: at most one finished-cake photo, and a baker can mark
  delivered with or without it.
- **Private photo**: visible only to the requester, the baker who made it, and
  admins. Never on the public browse (a public gallery is Slice 7).

## Who can do what (server-enforced, fail closed, with negative tests)

| Action | Endpoint | Allowed |
|--------|----------|---------|
| Commit | `POST /api/requests/:id/commit` | the reserving baker, or admin; request must currently be `reserved` |
| Mark delivered | `POST /api/requests/:id/deliver` | the reserving/committing baker, or admin; request must be `committed` |
| Confirm received | `POST /api/requests/:id/receive` | the owner (requester), or admin; request must be `delivered` |
| Release | `POST /api/requests/:id/release` (existing, extended) | the baker or admin; allowed from `reserved` or `committed`, not once delivered |
| Upload photo | part of `deliver` (server-mediated) | the baker; image type allow-list + size cap validated server-side |

The server never trusts a role or id from the browser; it derives them from the
verified token + `profiles`, exactly as Slices 4 already do.

## Data changes (Supabase)

Additive columns on `cake_requests` (legacy rows stay null → still `open`):

- `committed_at timestamptz`
- `delivered_at timestamptz`
- `received_at timestamptz`
- `photo_path text` — the key of the file in Storage (null when no photo)

Plus a **private** Storage bucket `cake-photos` (created in the dashboard,
Phase 3). Photos are stored under `<requestId>/<timestamp>.<ext>`.

## The photo, technically

- **Upload**: browser → our Express server → Supabase Storage (service key). The
  server checks the caller is the request's baker and validates the file
  (allow-list: jpeg/png/webp; size cap e.g. 5 MB), then stores it and records
  `photo_path`. The publishable key never touches Storage.
- **Viewing**: the bucket is private. An authorized viewer (owner / baker /
  admin) gets a short-lived **signed URL** from the server
  (`GET /api/requests/:id/photo` → `{ url }`, 403 otherwise); the browser shows
  it with a plain `<img>`. Everyone else gets nothing. Reuses the same
  "may see reserver" visibility rule already in `redactReserver`.

## Phased build (each ends with something visible)

1. **Commit to bake.** `committed_at` column + `/commit` endpoint + status
   derivation; the reserving baker sees "I'll bake this," and a committed cake
   shows "Baking" with the countdown gone. Release works from committed too.
2. **Delivered → received handshake.** `delivered_at` + `received_at` columns +
   `/deliver` and `/receive` endpoints; the baker's "Mark delivered" and the
   requester's "Confirm received" buttons + status badges close the loop. No
   photo yet.
3. **Finished-cake photo.** The `cake-photos` bucket + `photo_path` column;
   optional upload on the deliver step, server-validated; private signed-URL
   viewing for requester / baker / admin.

## Deliberately NOT in this slice

Photo **moderation** and baker **verification** (Slice 6); notifications and the
public **inspiration gallery** (Slice 7). Multiple photos per cake (one for now).
