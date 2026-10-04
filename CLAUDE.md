# Bake the Cake — project instructions

## Where the project lives (from saved notes; re-verify before relying on it)
- Frontend: Cloudflare Pages, https://bake-the-cake.pages.dev
- Backend: Render (free tier, sleeps when idle, ~50s cold start), https://bake-the-cake.onrender.com
- Database, auth and photos: Supabase
- Code: GitHub, https://github.com/Tamar05/bake-the-cake (branch `master`)

## Setup health checks

**When to run them** — NOT on every message. Only:
1. when the user asks ("check my setup"),
2. when something fails or looks broken, or
3. when the user is about to deploy or push.

**What to check (only what's relevant to the situation):**
- GitHub: local changes committed and pushed, remote connected.
- Cloudflare Pages (frontend): site deployed, latest push built.
- Render (backend, free tier): server asleep or failing, needs a manual deploy after a push.
- Supabase (database and photos): project paused, keys and URL correct, backups covered by the plan.
- Environment variables: frontend points to the right backend URL, backend to the right Supabase project.
- Anything else that looks broken, missing, or only half connected.

**How to report a problem:**
1. Say plainly what is wrong, in one sentence.
2. Give simple numbered steps to fix it, naming the exact website, menu, button, or command.
3. If Claude can fix it (e.g. by running a command), offer to, and ask before anything that changes or deletes data.
4. If something couldn't be checked, say so. Never assume it's fine.

**How to write it:**
- The user is not a professional developer: use simple language and explain technical terms briefly.
- If everything is healthy, say so in one short line instead of listing every check.
- Never guess. Separate what was verified just now from what comes from saved notes.
