# Slice 3: Translate Button — Design

**Goal:** Each request card gets an on-demand **Translate** button. Clicking it translates the request's typed-in text into the language the page is currently showing, using a free translation service (no API key). Clicking again toggles back to the original.

## Decisions (and how they differ from the earlier captured decision)

The original design (`2026-08-20-bake-the-cake-design.md`, §"Captured decision") assumed **Claude (Anthropic API)** as the translation engine, routed through the server to hide a secret key. **Updated 2026-08-20:** the user chose a **free, no-key service instead of a paid API**, so:

- **Engine:** [MyMemory Translation API](https://mymemory.translated.net/doc/spec.php) — free, no signup, no key for low volume; supports English↔Hebrew. Endpoint: `GET https://api.mymemory.translated.net/get?q=<text>&langpair=<from>|<to>`; the translated text is at `response.responseData.translatedText`.
- **Still routed through our own server** (`POST /api/translate`), even though there's no secret to hide, because it keeps the frontend simple, matches the Slice 2 pattern, is easy to test with a fake, and isolates the engine (swapping to Claude later would change only the server).

## What gets translated

- **All four typed-in text fields:** `recipient`, `occasion`, `dietary`, `location`. Empty fields (e.g. blank `dietary`) are skipped.
- **Not** translated: the fixed labels/buttons (already hand-written in both languages via i18n), the date, or the database ids.

## Translation direction

Always translate **into the language the page is currently showing**, from the other one:
- Page in Hebrew (`he`) → translate content `en → he`.
- Page in English (`en`) → translate content `he → en`.

We **assume the content is written in the other language** than the one currently displayed. No language auto-detection this slice (simplest thing that works).

## Architecture / data flow

```
Request card → [Translate] clicked
  → browser calls OUR server:  POST /api/translate  { text, to }
  → server's Translator calls MyMemory
  → { translated } returned → card swaps to translated text in place
```

Same split style as Slice 2: the HTTP route depends on a small `Translator` interface — a real MyMemory-backed translator in production, an in-memory fake in tests (so tests never hit the network).

## Server pieces (`server/`)

- **`src/translator.ts`**
  - `type Translator = { translate(text: string, from: string, to: string): Promise<string> }`.
  - `createMyMemoryTranslator(): Translator` — calls the MyMemory endpoint, returns `responseData.translatedText`; throws on a non-OK response or a service-reported error.
- **`src/app.ts`** — `createApp` gains a second parameter so it becomes `createApp(store: RequestsStore, translator: Translator)`; new route `POST /api/translate` uses that translator. (Existing `createApp(store)` call sites in `index.ts` and `app.test.ts` are updated to pass a translator too.)
  - Body `{ text: string, to: 'en' | 'he' }`. Derives `from` as the opposite of `to`.
  - `200` → `{ translated: string }`.
  - `400` if `text` is missing/blank or `to` is not `en`/`he`.
  - `500` if the translator throws.
- **`src/index.ts`** — creates the real MyMemory translator and passes it in alongside the Supabase store.
- **Tests:** the real MyMemory translator makes a live network call, so it is not unit-tested directly (verified in the human end-to-end step). The **route** is tested test-first in `src/app.test.ts` with a **fake translator** (returns predictable text like `[he]<text>`), asserting the 200/400/500 behavior.

## Frontend pieces (`src/`)

- **`src/lib/translationApi.ts`** (new, mirrors `requestsApi.ts`)
  - `translateText(text: string, to: Language): Promise<string>` — POSTs `{ text, to }` to `${VITE_API_BASE_URL}/api/translate`, returns `translated`. Throws on non-OK.
  - Test-first: `src/lib/translationApi.test.ts` with `fetch` mocked.
- **`src/components/RequestCard.tsx`** (new) — renders one card + the Translate button, and owns its own state:
  - `mode: 'original' | 'translated'`, `status: 'idle' | 'loading' | 'error'`, and a cached `translated` copy of the fields.
  - First click: translate the non-empty fields (calling `translateText` for each), cache them, switch to translated view, flip button to **Show original**. Subsequent toggles reuse the cache (no re-call).
  - While loading: button reads **Translating…**, disabled. On error: small inline message, stays on original.
- **`src/components/RequestList.tsx`** — simplified to map over requests and render a `RequestCard` per item (the inline card markup moves into `RequestCard`).
- **New i18n strings** (added to both `en.ts` and `he.ts`; `types.ts` extended; key-parity test enforces sync):
  - `translate` — button label ("Translate" / "תרגמו")
  - `showOriginal` — toggle-back label ("Show original" / "הצג מקור")
  - `translating` — busy label ("Translating…" / "מתרגם…")
  - `translateError` — inline failure message.

## Error handling

- Missing/blank text or bad target → `400` from the server; the frontend treats any non-OK as an error and shows `translateError` on the card.
- MyMemory unreachable or error → `500`; same friendly inline message; card stays on the original text.
- No global app breakage: a failed translation only affects the one card.

## Testing summary

- **Server:** `app.test.ts` gains `/api/translate` cases (200 with fake translator, 400 on missing text, 500 when the fake throws). No real network.
- **Frontend:** `translationApi.test.ts` (mocked `fetch`): posts correct body, returns translated text, throws on non-OK. Components covered by `npm run build` type-check.
- **i18n:** existing key-parity test covers the four new strings.
- **Human end-to-end:** run both servers, click Translate on a real card, confirm the fields translate into the current language and toggle back; switch language and repeat.

## Out of scope (YAGNI)

- No saving translations to the database (fresh per click; cached only in page memory; gone on refresh).
- No auto-translate-everything.
- No language auto-detection.
- No paid AI engine (deferred; the server split leaves that door open).
- No translating fixed labels (already handled by i18n).

## Constraints carried from earlier slices

- Build on `master`; ask before commits.
- English and Hebrew dictionaries keep identical keys (guarded by `src/i18n/i18n.test.ts`).
- Frontend reaches the server via `import.meta.env.VITE_API_BASE_URL`.
- Server runs via `tsx` in dev; type-checked with `tsc --noEmit`; tested with vitest + supertest.
