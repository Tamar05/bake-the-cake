// Registers the app's service worker (public/sw.js) for every visitor once the
// page has finished loading. This is what makes Bake the Cake installable as a
// PWA and lets it boot offline.
//
// It is separate from — and idempotent with — the push flow in pushApi.ts, which
// registers the same '/sw.js' on demand when a baker turns on notifications. The
// browser dedupes registrations by script URL + scope, so calling both is safe.
export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // Only in real builds: during `vite dev` a worker caching fingerprinted assets
  // just causes stale-file confusion. Test the PWA with `vite preview` instead.
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Progressive enhancement — the app works without it, so ignore failures.
    });
  });
}
