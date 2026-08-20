# Bake the Cake — Design & Roadmap

*Written 2026-08-20. This is a living plan — we update it as we learn.*

---

## 1. What Bake the Cake is

A **charity platform** that connects people who need a celebration cake with
volunteer bakers who make one for free, coordinated by admins.

Three kinds of people use it:

- **Requester** — asks for a cake (who it's for, theme, date, dietary needs).
- **Volunteer / Baker** — sees nearby requests, reserves one, bakes it, uploads
  photos, marks it delivered.
- **Admin** — verifies bakers, helps stuck requests, moderates photos, watches
  a stats dashboard.

The feeling we want: warmth. Someone in a hard moment gets a cake made with
care by a stranger, and both sides feel good afterwards.

*(Full flow lives in the Figma workflow board that started this project.)*

---

## 2. How it's built (same stack as pocket-pt)

Three separate parts, exactly like pocket-pt:

| Part | Plain meaning | Technology | Hosted on |
|------|---------------|------------|-----------|
| **Frontend** | What people see and click | React + TypeScript + Vite | Cloudflare |
| **Backend** | Behind-the-scenes program that saves data & enforces rules | Express (Node) + TypeScript | Render |
| **Database** | Where the data lives | Supabase | Supabase |

**Why match pocket-pt:** same tools in both projects means everything learned in
one carries straight over to the other. No juggling two different systems.

**Key principle — switch each part on only when a slice needs it:**

- The frontend exists from Slice 1.
- The backend + database arrive at Slice 2 (the first time data must be *saved*).
- Live deployment (Cloudflare + Render on the real internet) happens whenever we
  want to show people — never required to keep building locally.

---

## 3. Guiding principles

1. **Smallest thing that works first.** Build one thin, complete slice, see it
   working, then add the next. Never build the whole board at once.
2. **See it working fast.** Every slice ends with something visible on screen.
3. **Keep looks and logic separate.** Makes the app easier to grow and change.
4. **Human before AI.** The board's AI validation/tagging is pushed to the end.
   Early on, a carefully-filled form is enough.
5. **Bilingual from the start (English + Hebrew).** Never type words directly
   into screens — keep them in swappable word-lists so the language can change.
   Hebrew reads right-to-left, so the layout must be able to flip direction.
   Designing this in from Slice 1 is far easier than bolting it on later.
6. **Honest pace.** This is a months-not-days project for someone learning as
   they go. That is the normal, healthy speed.

---

## 4. The slice roadmap

Each slice is a working milestone you can see and use.

| # | Slice | You'll be able to... | New skill | Stack parts needed |
|---|-------|----------------------|-----------|--------------------|
| **1** | Request form + open list | Fill a cake request, submit, see it appear in a list | Forms, buttons, showing data | Frontend only (data faked in the browser) |
| **1.5** | Language toggle (EN / עברית) | Switch the whole app between English and Hebrew; layout flips for Hebrew | Word-lists, right-to-left layout | Frontend only |
| **2** | Make it remember | Requests stay saved after closing the browser | Databases | + Backend (Render) + Database (Supabase) |
| **3** | Baker browse & reserve | Bakers see open requests and reserve one for a set time | Multiple screens, a timer | Frontend + Backend + Database |
| **4** | Accounts / logging in | Sign in as requester, baker, or admin; each sees their own view | User accounts (auth) | + Supabase Auth |
| **5** | Fulfillment flow | Baker uploads finished-cake photos, marks delivered; requester confirms received | Photo uploads, status tracking | + File storage |
| **6** | Admin tools | Verify bakers, moderate photos, outreach on stuck requests | Permissions, moderation | (uses existing parts) |
| **7** | The magic touches | AI tagging, notify-nearest-baker, Compassion Timeline, inspiration gallery, stats dashboard | Several advanced bits, one at a time | Various — each its own mini-project |

**Reading the map:** Slices 1–3 already give a usable app (people request cakes,
bakers claim them). Slice 4 (accounts) is the "grown-up app" jump. Slice 7 is
the wish-list — only meaningful once the core works.

### Captured decision — "Translate this request" button (a Slice 7 magic touch)

Decided 2026-08-20. Two different kinds of "translate" exist, and they are not
the same size:

- **App's own words** (labels, buttons) — hand-written in both languages ahead
  of time. Free, instant, offline. This is Slice 1.5.
- **Typed-in content** (recipient name, occasion, dietary notes) — unpredictable
  text nobody wrote in advance, so it needs a **live online AI/translation
  engine** at view time.

**What we chose:** an **on-demand "Translate" button** on each request card —
it calls the translation engine only when someone clicks it (cheaper and simpler
than auto-translating everything).

**Why it waits:** calling an AI service needs a secret API key, which must live
on the **server, never in the browser** (a browser-embedded key can be stolen
and abused). The server arrives in **Slice 2**. So the Translate button is built
**after Slice 2**, reusing the language state that Slice 1.5 introduces. Claude
(the Anthropic API) is the intended translation engine.

---

## 5. Slice 1 in detail (what we build first)

**Goal:** a person fills out a cake request form, clicks Submit, and their
request appears in a list of "Open requests" on the same page.

**Frontend only.** No backend, no database yet — the list lives in the browser's
memory. Refreshing the page clears it. That's fine and expected; Slice 2 fixes it.

**The form asks for:**
- Who the cake is for (a name or short description)
- The occasion / theme (e.g. "8th birthday, dinosaurs")
- The date it's needed
- Dietary needs (e.g. "nut-free") — optional
- Rough location (e.g. town or postcode) — for future baker matching

**What happens on Submit:**
1. Check the required fields are filled (gentle message if not).
2. Add the request to the top of the "Open requests" list.
3. Clear the form, ready for the next one.

**What it deliberately does NOT do yet:** save permanently, notify anyone,
handle bakers, or check for duplicates. All of that comes in later slices.

**Files this slice touches** (React + Vite structure, mirroring pocket-pt):
- `index.html` — the single page the app loads into
- `src/main.tsx` — starts the app
- `src/App.tsx` — the screen: form + list
- `src/components/RequestForm.tsx` — the form
- `src/components/RequestList.tsx` — the list of open requests
- `src/types.ts` — the shape of one "cake request"
- `src/i18n/en.ts` and `src/i18n/he.ts` — the English and Hebrew word-lists.
  Even in Slice 1 we pull the form's labels from these instead of typing them
  directly, so Slice 1.5 (the toggle) is a small step, not a rewrite.
  (*i18n* = "internationalization", the standard word for multi-language support.)

### Slice 1.5 — Language toggle (EN / עברית)

**Goal:** a small toggle switches the whole app between English and Hebrew.

- All visible words come from `src/i18n/en.ts` / `src/i18n/he.ts`.
- Choosing Hebrew flips the page to right-to-left (menus, buttons, fields mirror).
- The chosen language is remembered while the app is open.

---

## 6. What replaces the starter page

The plain-HTML placeholder (`index.html`, `styles.css`, `script.js` — the pink
cake card) gets replaced by the React + Vite setup above. It was only ever a
"prove the folder works" placeholder; nothing important is lost.

---

## 7. Open questions (to decide as we go)

- Visual style — colours, fonts, logo. (We'll shape this while building Slice 1.)
- Exact fields on the request form — easy to adjust later.
- When to do the first live deployment (Cloudflare + Render).
```
