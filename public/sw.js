/* Service worker for Bake the Cake web push (Phase 1).
 *
 * Its job in Phase 1 is simply to exist, so a baker's browser can hold a push
 * subscription. The push / notificationclick handlers below are what will render
 * and route an incoming notification once Phase 2 starts sending them, so they
 * live here from the start. Plain JS (served from /public), not TypeScript. */

// Activate a freshly deployed worker straight away rather than waiting for every
// tab to close first.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
