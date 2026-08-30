# Deploying Bake the Cake

The app has three pieces:

- **Database** → Supabase (already set up — nothing to do here).
- **Backend API** → Render (a small Node web service).
- **Frontend** → Cloudflare Pages (the website people visit).

Both Render and Cloudflare deploy straight from a **GitHub repository**, so the
first step is getting the code onto GitHub. All three have free tiers, so this
can cost nothing to start. (Render's free backend "sleeps" after ~15 minutes
idle, so the first visit after a quiet spell takes ~30–60s to wake up.)

The values you'll paste into the dashboards are already in your local env files:
`server/.env` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) and `.env`
(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).

---

## Step 1 — Put the code on GitHub

1. Create a new, **empty** repository at https://github.com/new (e.g.
   `bake-the-cake`). Don't add a README/licence/.gitignore — the repo already
   has them.
2. Tell your assistant the repo URL; it will connect the remote and push `master`.

*(Your secrets are safe: `.env` files are git-ignored and never leave your
machine.)*

---

## Step 2 — Backend on Render

1. Go to https://dashboard.render.com → **New** → **Web Service** → connect your
   GitHub and pick the `bake-the-cake` repo.
2. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
   - **Health Check Path**: `/api/health`
3. Add **Environment Variables** (from your `server/.env`):
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your **secret** key
   - *(leave `CORS_ORIGIN` out for now — added in Step 4)*
4. **Create Web Service**. When it finishes, copy the URL at the top, e.g.
   `https://bake-the-cake-server.onrender.com`.
5. Quick check: open `https://<that-url>/api/health` — you should see
   `{"ok":true}`.

---

## Step 3 — Frontend on Cloudflare Pages

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git** → pick the `bake-the-cake` repo.
2. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: leave as `/`
3. Add **Environment Variables** (Production):
   - `VITE_API_BASE_URL` = your Render URL from Step 2 (no trailing slash)
   - `VITE_SUPABASE_URL` = your project URL (same as backend)
   - `VITE_SUPABASE_ANON_KEY` = your **publishable/anon** key (from `.env`)
4. **Save and Deploy**. When it finishes, copy the site URL, e.g.
   `https://bake-the-cake.pages.dev`.

---

## Step 4 — Connect them (CORS) and test

1. Back in **Render** → your service → **Environment** → add:
   - `CORS_ORIGIN` = your Cloudflare URL, e.g. `https://bake-the-cake.pages.dev`
     (no trailing slash). Save — Render redeploys automatically.
2. In **Supabase** → Authentication → URL Configuration → add your Cloudflare URL
   to the **Site URL / redirect allow-list** so sign-in works from the live site.
3. Open your Cloudflare URL, sign in, and post a request. Done. 🍰

---

## Updating later

Every `git push` to `master` redeploys both Render and Cloudflare automatically.
Changing an environment variable requires a redeploy (Render does it on save;
Cloudflare has a **Retry deployment** button).
