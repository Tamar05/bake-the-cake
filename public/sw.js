/* Service worker for Bake the Cake.
 *
 * Two jobs live here:
 *   1. Web push (Phase 1) — hold a baker's push subscription and, once Phase 2
 *      sends them, render/route incoming notifications (the push /
 *      notificationclick handlers at the bottom).
 *   2. PWA offline shell — precache the app shell and cache same-origin assets
 *      so the installed app opens fast and still boots without a connection.
 * Plain JS (served from /public), not TypeScript. */

// Bump this version whenever the cached shell should be replaced; the activate
// handler then clears every older cache.
const CACHE = 'btc-shell-v1';

// The minimum needed to boot the app offline. Vite fingerprints the JS/CSS under
// /assets, so those filenames aren't known here — they get cached at runtime on
// first visit by the fetch handler below.
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
];

// Precache the shell, then activate straight away rather than waiting for every
// tab to close first.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll is all-or-nothing; add individually so one 404 can't abort install.
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

// Take control of open tabs and drop any stale caches from older versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Serve GET navigations and same-origin assets from the cache so the installed
// app is fast and offline-capable. Everything else (the API on its own origin,
// Supabase, non-GET) is left untouched — never cached, never intercepted.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API / Supabase pass straight through

  // Page navigations: try the network first (fresh app), fall back to the cached
  // shell when offline so the single-page app can still start up.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  // Static assets (JS, CSS, icons): serve from cache immediately, refresh in the
  // background (stale-while-revalidate).
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

// A push arrived: show a notification. The server sends a small JSON payload;
// we fall back to gentle defaults if it's missing or unparseable.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_err) {
    data = {};
  }
  const title = data.title || 'Bake the Cake';
  const options = {
    body: data.body || 'A new cake request may be a match for you.',
    data: { url: data.url || '/' },
  };
  if (data.icon) options.icon = data.icon;
  if (data.badge) options.badge = data.badge;
  if (data.tag) options.tag = data.tag;
  event.waitUntil(self.registration.showNotification(title, options));
});

// The baker tapped the notification: focus an open tab (navigating it to the
// target) or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
      }),
  );
});
