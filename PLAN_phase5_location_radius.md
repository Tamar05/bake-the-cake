# Phase 5 — Nationwide location: town + travel radius + distance matching

## Goal
Replace the current Beit-Shemesh-only "delivery area" system (8 hardcoded neighborhoods) with a
real nationwide town list: a requester picks their town from ~220 Israeli towns/cities (or types
one that's missing, flagged for review); a baker sets their home town + how far they'll travel;
matching becomes straight-line distance instead of exact area equality.

**Scope confirmed with the user**: the brainstormed plan assumed nationwide reach, which
contradicts the app's current code/README (Beit Shemesh neighborhoods only) — the user confirmed
nationwide is the actual intent, so this plan builds the full town list as originally scoped.

## Data source (verified, not fabricated)
Typing ~220 town names with lat/lng from memory risks real distance errors, so the list is built
from GeoNames' public Israel export (`download.geonames.org/export/dump/IL.zip`), filtered to
populated places, deduplicated, and manually spot-fixed for a handful of ASCII-transliteration
artifacts (missing spaces like "QiryatMotsqin", a stale "West Jerusalem" duplicate record). 219
towns survive, each with `{ name, lat, lng }`, sorted alphabetically. Beit Shemesh itself is
included (it's simply the largest town most current activity happens in — no longer special-cased
in code).

**Known limitation, flagged rather than silently decided**: GeoNames' primary names for Israel are
transliterated Latin script (e.g. "Jerusalem", "Bet Shemesh"), not Hebrew. Translating all 219 into
correct Hebrew spellings isn't practical to source reliably right now, so **town names display
identically in both language modes** for this phase — no `t.options.town` translation map like the
old `t.options.area` had. This is a real scope reduction from full i18n coverage; revisit later if
it matters.

## Data model changes
- New `server/src/towns.ts` + `src/lib/towns.ts` (duplicated, mirroring the existing
  `options.ts` pattern and its enforced-equality test) — the 219-entry list plus:
  ```ts
  export function distanceKm(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  export function findTown(name: string): Town | undefined { ... } // exact, case-sensitive match
  ```
- DB migration (SQL the user runs by hand, per this project's convention):
  ```sql
  alter table profiles add column if not exists home_town text;
  alter table profiles add column if not exists travel_radius_km integer;

  -- Every existing baker was operating in a Beit-Shemesh-only world; give them
  -- a starting point that roughly covers what "matches my area" used to mean,
  -- rather than leaving them unmatched until they visit Settings.
  update profiles
  set home_town = 'Bet Shemesh', travel_radius_km = 15
  where role = 'baker' and home_town is null;
  ```
  `profiles.notify_areas` (the old capability list) is left in place, untouched, unused going
  forward — not dropped, per this project's usual caution around schema removal.

**Critical gap an initial draft missed (caught by review): existing requests' `location` values.**
This app's live data has open/in-flight requests whose `location` is one of the 8 old area names
("Rama A", etc.) — none of which are real entries in the new 219-town list, and none prefixed
`Other: `. Without handling this, `matching.ts` would call the distance lookup on an unresolvable
town for every such request and — unless made defensive (see below) — crash the notification bell
(`/api/me/notifications/new`) for every baker the moment any legacy-location request exists, which
is true of the live app today. Two-part fix:
```sql
-- One-time: the only 8 values this app has ever stored are real Beit Shemesh
-- neighborhoods, so map them straight to the town that contains them.
update cake_requests
set location = 'Bet Shemesh'
where location in
  ('Old Beit Shemesh','Rama A','Rama B','Rama C','Rama D','Mishkafayim','Neve Shamir','Ramat Avraham');
```
plus, defensively, `matching.ts` treats ANY location that doesn't resolve to a known town (not just
ones already covered by that SQL) as "no distance match" rather than throwing — covering any future
straggler value without needing a giant SQL `IN (...)` of all 219 town names. This mirrors the
existing "legacy row with no kashrut level → never matches" pattern already in this file.

## Request location field
- `RequestDraft.location` keeps its existing shape (`string`) — no request-table schema change.
  Valid values become: an exact town name from the list, OR free text prefixed `Other: ` (e.g.
  "Other: Ma'ale Adumim") when someone can't find their town.
- `server/src/app.ts`'s `buildRequestDraft` validation changes from `AREAS.includes(...)` to
  `findTown(value) != null || value.startsWith('Other: ')`.
- `RequestForm.tsx`'s location `<select>` becomes a searchable combobox (a plain `<input>` with a
  native `<datalist>` of the 219 town names — no new dependency, works with keyboard/screen
  readers) plus a same-row fallback: typing something not in the list is accepted as `Other: <text>`
  automatically, no separate toggle needed.

## Baker capabilities: home town + radius replaces the area checklist
- `server/src/profilesStore.ts` `NotificationPrefs`/`NotificationSettings`: `areas: string[]` →
  `homeTown: string; travelRadiusKm: number`. `getNotificationSettings`/`setNotificationSettings`
  read/write `home_town`/`travel_radius_km` instead of `notify_areas`.
- `server/src/app.ts` `parseNotificationPrefs`: validates `homeTown` via `findTown()`; `travelRadiusKm`
  is clamped (not rejected) to 1–300 km — review confirmed this is genuinely low-stakes, since
  matching only ever affects notification relevance, never Browse visibility or reservation
  eligibility (verified against the `GET /api/requests` handler, which lists every open request to
  every baker with no capability filtering) — so a generous clamp beats a rejection error here.
- `server/src/matching.ts` `matchesCapabilities`: area-equality replaced by
  `distanceKm(townOf(request.location), townOf(baker.homeTown)) <= baker.travelRadiusKm`. A
  request whose location is `Other: ...` (unresolvable to coordinates) never matches by distance —
  it simply never triggers a notification, exactly like today's "legacy row with no area" case;
  **it remains fully visible and reservable on the Browse page**, since matching.ts only drives
  the notification bell/push (`/api/me/notifications/new`, `pushNotify.ts`) — confirmed
  `GET /api/requests` lists every open request to every baker regardless of capability match, so
  this is a notification-relevance filter, not an access gate. No behavior change to what a baker
  can see or reserve.
- Client: `AuthPanel.tsx`'s baker sign-up capabilities section and `BakerNotificationsPage.tsx`
  both swap the "Areas you deliver to" `CapabilityGroup` for a town combobox (same pattern as the
  request form's) + a number input for travel radius (km).

## "Other" review — reusing the existing Needs Attention pattern, not a new screen
Per the brainstorm, an admin should see when someone's request names a town outside the list.
Rather than a new table/endpoint, `attentionReason()` gains one more case, guarded by the same
`!done` check the existing reasons use — so it clears once the cake is delivered/received instead
of sitting on the list forever (a gap an earlier draft had: no such guard, so a request could stay
flagged permanently with no way to dismiss it):
```ts
if (!done && request.location.startsWith('Other: ')) return 'unrecognized-town';
```
surfaced through the existing `/api/attention` + `AdminAttentionPage.tsx` — zero new surface area.

**Real limitation to flag, not silently paper over**: because the town list is a compiled static
file (not a DB table, matching this project's existing `options.ts` pattern and the brainstorm's
"free, offline" requirement), an admin *seeing* an unrecognized town here cannot literally add it
through the UI — doing so still requires a code change (asking a Claude session to add it to
`towns.ts`). If the user wants admins to add towns live without a code change, that's a bigger
redesign (towns as a DB table) — out of scope here unless asked for.

## Incidental fix made while touching this code
`listNotifiableBakers()` (the push fan-out audience query) checked `verified_at` but never
`suspended_at` — a bug from Phase 4 that this file's edit surfaced: a suspended baker would still
receive push notifications for new requests despite being unable to reserve/bake. Fixed in the
same change (`.is('suspended_at', null)` added to the query) since it was directly adjacent to
the area→radius field rename already touching this function.

## Explicitly out of scope
- No changes to existing `AREAS`/`DIETARY_OPTIONS`/`KASHRUT_OPTIONS` dietary/kashrut matching —
  only the area/location half of `matchesCapabilities` changes.
- No live geocoding API, no map UI — a flat searchable list + haversine distance, per the
  brainstorm's "free, offline" requirement.
- No Hebrew translation of town names this phase (see Known limitation above).

## Risk / review checklist (schema migration + sign-up-form touch → full check)
- [ ] The `update profiles ... where role = 'baker' and home_town is null` migration only ever
      sets a value where one doesn't already exist — safe to re-run, never overwrites a baker who
      already set their own home town/radius before this ships (there shouldn't be any, but the
      guard costs nothing).
- [ ] `findTown()` / the `Other: ` prefix check is applied server-side in `buildRequestDraft` and
      `parseNotificationPrefs` — never trusts a client-supplied town name without validating it
      resolves to real coordinates (or is explicitly the free-text escape hatch).
- [ ] No new admin-privilege path: the attention-screen addition reuses the existing
      `requireRole('admin')` gate on `/api/attention`, unchanged.
- [ ] `travelRadiusKm` is bounded server-side (not an unbounded client-supplied number) to avoid a
      degenerate "radius = 999999" effectively disabling relevance filtering entirely.
- [ ] `matching.ts`'s distance check never throws on an unresolvable town name (legacy or
      otherwise) — it returns "no match," so the notification bell can't 500 for every baker
      because of one bad row.
- [ ] The legacy `cake_requests.location` migration SQL runs before this ships, so no live request
      is left holding a pre-Phase-5 area name.
