// Web push, client side (Phase 1): register the service worker, subscribe this
// device with the VAPID key, and hand the subscription to the server — plus the
// reverse, to turn it off. The pure helpers and the fetch wrappers are unit
// tested; the browser-API orchestration is thin, feature-detected glue.

// The JSON shape the browser's PushSubscription.toJSON() produces (the subset we
// send to the server: the endpoint plus the two encryption keys).
export type PushSubscriptionJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// The VAPID public key is delivered as a base64url string; PushManager.subscribe
// wants the raw bytes. Add back the padding base64url drops, swap the url-safe
// characters, then decode.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

// True only where this browser can actually do web push (a service worker, a
// push manager, and the Notification API). Everything else short-circuits so the
// UI can hide or disable the toggle rather than throwing.
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Sends this device's push subscription to the server (the baker opted in).
export async function sendPushSubscription(
  subscription: PushSubscriptionJson,
  token: string,
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/me/push-subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new Error(`Could not enable notifications (HTTP ${res.status})`);
}

// Tells the server to forget this device's subscription (the baker opted out).
export async function removePushSubscription(endpoint: string, token: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/me/push-subscriptions`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new Error(`Could not disable notifications (HTTP ${res.status})`);
}

// The VAPID public key, safe to ship to the browser (the private key stays in
// server/.env). Read lazily inside the flow so the module loads without it.
function vapidPublicKey(): string | undefined {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
}

// Why enabling failed, so the page can show the right message.
export type EnablePushError = 'unsupported' | 'missing-key' | 'denied' | 'failed';

// The whole "turn notifications on for this device" flow: register the worker,
// ask permission, reuse or create a subscription with the VAPID key, and send it
// to the server. Rejects with an EnablePushError the caller can map to copy.
export async function enablePushOnThisDevice(token: string): Promise<void> {
  if (!isPushSupported()) throw new Error('unsupported' satisfies EnablePushError);
  const key = vapidPublicKey();
  if (!key) throw new Error('missing-key' satisfies EnablePushError);

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('denied' satisfies EnablePushError);

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true, // required by browsers: every push shows a notification
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  await sendPushSubscription(subscription.toJSON() as PushSubscriptionJson, token);
}

// Turn notifications off for this device: drop the local subscription and tell
// the server to forget it. A no-op if there was nothing subscribed.
export async function disablePushOnThisDevice(token: string): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await removePushSubscription(endpoint, token);
}

// Whether this device already has an active push subscription, so the page can
// show the toggle in the right state on load. Safe to call anywhere.
export async function isSubscribedOnThisDevice(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  return (await registration.pushManager.getSubscription()) != null;
}
