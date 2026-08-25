# Slice — Baker browse & reserve (design)

*Written 2026-08-25. The next core slice from the roadmap (§4, "Baker browse &
reserve"). The Translate button that shipped earlier was a Slice-7 "magic touch"
pulled forward, so this is the real next step.*

---

## Goal

So far people can only **ask** for a cake. This slice lets a volunteer **step up
to make one**: they see the open requests, press **Reserve** on one, leave their
name + contact, and the request shows as **Reserved** with a **1-hour countdown**.
If they don't follow through, it **auto-returns to Open** after the hour so nothing
gets stuck.

No accounts yet (that's the next slice). Reserving is open to anyone; we just
capture a name + contact as free text, which upgrades cleanly to real accounts later.

## Decisions (confirmed with the user)

- **Reserve captures:** baker **name + contact** (phone or email).
- **Hold length:** **1 hour**, then auto-expire back to Open.
- **Expiry is computed, not scheduled** — no background job. The server decides
  "reserved or open" every time it reads a request (reserved only while
  `reserved_at + 1h > now`). The browser shows a live countdown from the same clock.

## Data change (Supabase `cake_requests`) — additive only

Three new **nullable** columns. Existing rows and the current insert path are
untouched (an unreserved request simply leaves them empty):

| Column | Type | Meaning |
|--------|------|---------|
| `reserved_by` | text | baker's name (null when open) |
| `reserved_contact` | text | baker's phone/email (null when open) |
| `reserved_at` | timestamptz | when it was reserved (null when open) |

The user runs this SQL in Supabase (they do the DB clicks).

## Server

- `CakeRequest` gains `status: 'open' | 'reserved'`, `reservedBy`, `reservedContact`
  (nullable), and `reservedUntil` (ms epoch the hold ends, or null).
- `rowToRequest(row, now)` computes status: reserved only while not expired;
  expired or never-reserved reads as `open` with the reservation fields nulled.
- Store gains `reserveRequest(id, name, contact)` (refuses if already actively
  reserved → 409) and `releaseRequest(id)` (clears the fields).
- New routes: `POST /api/requests/:id/reserve` (body `{name, contact}`) and
  `POST /api/requests/:id/release`. Both return the updated request.
- Tests: reserve flips status, double-reserve is rejected, release re-opens.

## Frontend

- `requestsApi` gains `reserveRequest` / `releaseRequest`.
- `App` replaces a single request in state when a card reports an update
  (`onUpdated`), passed down through `RequestList` to `RequestCard`.
- `RequestCard`:
  - **Open** → a **Reserve** button that opens a small inline form (name +
    contact) with confirm/cancel, loading + error states.
  - **Reserved** → a "Reserved" badge, who reserved it + their contact, a live
    **Xm Ys left** countdown, and a **Release** button. When the countdown hits
    zero the card returns to the Open view on its own.
  - Existing Translate button stays; the two features coexist.
- New bilingual strings (EN + he) for every new label.

## Deliberately NOT in this slice

Accounts/login (next slice), notifications, and matching bakers to nearby
requests. A simple **Open / Reserved / All filter** is an easy follow-up step.
