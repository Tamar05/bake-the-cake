# Smart in-app notifications + relevance matching (design — NOT yet built)

*Written 2026-08-27. Brainstormed and approved in chat, but **no code written
yet**. This replaces the baker EMAIL notifications with **in-app** ones, makes
them **relevance-based** (area + dietary + kashrut, matched to what a baker is
willing to make), and enriches requests. Build it in the phased order below.*

---

## Why

The email notifications (baker-commit email, new-request alert email) only reach
the Resend account owner until a domain is verified, and the user decided the
information should live **in the app** instead. On top of that, a baker should
only be notified about a **relevant** new cake — one in their **area**, within
the **dietary needs** they can handle, and at a **kashrut (הכשר)** level they can
provide.

## Decisions already made (in chat)

- **Baker gets delivery info IN-APP, not by email.** Once a baker is baking a
  cake (committed → delivered → received), show the **requester's phone** on that
  cake's card — visible to the assigned baker + admins only (it's already
  returned unredacted to the assigned baker; the frontend just needs to display
  it). See `redactReserver` in `server/src/app.ts`.
- **Remove BOTH baker emails** and their server code/tests:
  - the commit email (`Notifier.sendBakeConfirmation`, wired in the
    `POST /api/requests/:id/commit` handler) — added in commit `0b0bca1`.
  - the new-request alert email (`Notifier.sendNewRequestAlert` +
    `profilesStore.getVerifiedBakerEmails`, wired in `POST /api/requests`) —
    added in commit `2212a41`.
  - Keep `emailer.ts`/Resend wiring pattern only if trivial; otherwise remove the
    now-unused methods, the fake notifiers' methods, and the related tests in
    `server/src/app.test.ts`. (`profilesStore.getContacts` stays — the
    needs-attention admin view uses it.)
- **Notifications are OPT-IN, in-app, "bell + list".** A baker turns on
  "Notify me of new requests" and picks the areas / dietary / kashrut they're
  willing to make. A 🔔 bell in the header shows a **count** of new, **relevant**
  open requests since they last looked; clicking it opens a **panel listing**
  them (occasion + area), each linking to the browse list; viewing clears the
  count. Pull-based (refreshes on app load / when opened) — NOT real-time push
  (that would need websockets/Supabase Realtime, a bigger future project).
- **Shared dropdown lists** (both requester on the form and baker in settings
  pick from the same list, so matches are exact):
  - **Area** — the request form's free-text `location` becomes an **Area
    dropdown**. Proposed starter list (user to confirm/edit): Jerusalem, Tel
    Aviv, Haifa, Rishon LeZion, Petah Tikva, Ashdod, Netanya, Beer Sheva, Holon,
    Ramat Gan, Bnei Brak, Rehovot, Beit Shemesh, Herzliya, Kfar Saba, Modiin,
    Nazareth, Other. The requester still gives their **phone** for the exact
    address.
  - **Dietary needs** — a shared list **+ Other**, replacing the free-text
    `dietary`. Likely **multi-select** (a cake can be e.g. nut-free AND vegan).
    Suggested: nut-free, gluten-free, dairy-free, vegan, vegetarian, egg-free,
    sugar-free, Other. **User to finalize the list.**
  - **Kashrut (הכשר)** — a shared list of kosher-certification levels. **User
    must provide the exact list** (e.g. Rabbanut, Rabbanut Mehadrin, Badatz Eda
    Haredit, Badatz Beit Yosef, Chatam Sofer, "not required", Other — these are
    placeholders; confirm with the user).

## New requirements added (this session — to design into the build)

- **Dietary list + Other** (above) — request picks its dietary needs from the
  list; baker sets which dietary needs they can accommodate.
- **Kashrut list** (above) — request picks the required kashrut; baker sets which
  kashrut level(s) they can provide.
- **Baker capability filter:** a baker chooses, from the area / dietary / kashrut
  lists, what they are **willing/able to do**. They're notified only about a new
  cake that matches **all** of: area ∈ their areas, the request's dietary needs ⊆
  their dietary capabilities, and the request's kashrut ∈ their kashrut
  capabilities.
- **"About the recipient" note:** a new optional free-text field on the request
  where the requester tells a bit about who the cake is for, so the baker can
  **customise** it. Shown to the baker (and owner/admin) — treat like other
  request detail; decide whether it's private (baker-only) or shown more broadly.

## Relevance matching (the core rule)

A new **open** request is "relevant" to a baker (with notifications ON) when:

```
request.area ∈ baker.areas
AND request.dietary ⊆ baker.dietaryCapabilities   (baker can handle every need)
AND request.kashrut ∈ baker.kashrutCapabilities
```

Compute server-side (pure, unit-testable function, like `attention.ts`).

## Data model (Supabase — user runs SQL)

- On `cake_requests`: keep `location` (now holds an area name); consider making
  `dietary` hold a delimited list or add `dietary_needs text[]`; add `kashrut
  text`; add `about_recipient text`.
- On `profiles` (baker settings): `notify_new_requests boolean default false`,
  `notify_areas text[]`, `notify_dietary text[]`, `notify_kashrut text[]`, and
  `notifications_seen_at timestamptz` (for the "new since last seen" count).
  (Postgres `text[]` arrays, or JSON — pick one and be consistent.)

## Suggested build order (phased, test each)

1. **Shared option lists** — one module of constants (areas, dietary, kashrut),
   shared client+server (or duplicated with a parity test).
2. **Request form** — Area dropdown (replace free-text location), Dietary
   multi-select + Other, Kashrut dropdown, and the "about the recipient" field.
   Server: validate/store them.
3. **In-app delivery phone** on the baker's baking card + remove the commit
   email.
4. **Baker notification settings** — opt-in toggle + area/dietary/kashrut
   capability pickers (a place for these: a small settings panel; there's no
   profile-edit UI yet, so this needs a home — e.g. a bell dropdown or a settings
   route). Remove the new-request alert email.
5. **Relevance matching + bell** — server endpoint(s) for the baker's relevant
   new-request list/count + mark-seen; header bell with count + panel list.

## Open questions for the user (next session)

1. **Finalize the three lists** — especially the **kashrut (הכשר) list** (the
   user must supply the real certification names) and the dietary list; confirm
   or edit the area list.
2. **One area or several** per baker for notifications? (Design assumes several /
   multi-select for all three.)
3. **"About the recipient"** — private to the baker, or shown on the card more
   broadly?
4. Does the request form keep any **free-text location detail**, or is the Area
   dropdown the only location (baker phones for the exact address)? (Design
   assumes Area dropdown only + phone.)

## Current app state (what's already built & committed)

Slices 1–6 complete; Slice 7 extras done: stats dashboard, Compassion Timeline,
public gallery, baker commit-email, new-request alert email (both to be REMOVED
per above), per-request delivery phone with `libphonenumber-js` validation, and
a sign-in password toggle. Last commit `484b8eb`. Two servers (frontend :5173,
backend :3001). Email only reaches the Resend account owner until a domain is
verified. Full status in project memory.
