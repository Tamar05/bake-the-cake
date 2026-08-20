# Bake the Cake 🍰

A charity web app that connects people who need a celebration cake with
volunteer bakers who make one for free. Same tech stack as the pocket-pt
project (React + TypeScript + Vite frontend, Express backend, Supabase database).

---

## 👉 START HERE — how to continue building

This project is built **one small slice at a time**. The full plan (vision,
tech stack, and the step-by-step roadmap) lives here:

**`docs/superpowers/specs/2026-08-20-bake-the-cake-design.md`**

Read that first. Then, to pick up work with Claude Code:

1. Open this `bake-the-cake` folder in VS Code (you're likely here already).
2. Trust the folder if VS Code asks (dismiss "Restricted Mode").
3. Open Claude Code **in this window** and start a new conversation.
4. Paste this to Claude to get going:

   > Read `docs/superpowers/specs/2026-08-20-bake-the-cake-design.md`.
   > It's the plan for this project. Let's build Slice 1 — the cake request
   > form and the list of open requests. I'm new to coding, so explain each
   > step in plain English and keep changes small.

That single message gives a fresh Claude Code everything it needs — it reads
the plan and continues exactly where we left off.

---

## Where things stand right now

- ✅ Project folder created, separate from pocket-pt, with its own git history.
- ✅ Full design + roadmap written (the doc linked above).
- ✅ Language plan decided: **English + Hebrew**, built in from the start
  (Hebrew reads right-to-left, so the layout flips).
- ⬜ **Slice 1 not started yet** — that's the next thing to build.

The current files (`index.html`, `styles.css`, `script.js`) are a temporary
plain-HTML placeholder — a "prove the folder works" pink cake page. They get
**replaced** by the proper React setup when Slice 1 begins. Nothing important
is lost.

---

## The roadmap at a glance

| # | Slice | What you get |
|---|-------|--------------|
| 1 | Request form + open list | Fill a cake request, see it listed |
| 1.5 | Language toggle (EN / עברית) | Switch languages; layout flips for Hebrew |
| 2 | Make it remember | Requests stay saved (adds backend + database) |
| 3 | Baker browse & reserve | Bakers claim requests |
| 4 | Accounts / logging in | Sign in as requester, baker, or admin |
| 5 | Fulfillment flow | Photos, mark delivered, confirm received |
| 6 | Admin tools | Verify bakers, moderate photos, outreach |
| 7 | Magic touches | AI tagging, matching, gallery, stats dashboard |

Full detail for each slice is in the design doc.

---

## The reference project

`pocket-pt` (in `C:\Users\PC\pocket-pt`) is a separate, unrelated project that
uses the **same tech stack**. When unsure how to structure something here,
look at how pocket-pt does it — it's a working example to copy patterns from.
