import webpush from 'web-push';
import type { PushSubscriptionInput } from './pushStore';

// The content of one push notification. Kept small and non-sensitive — it can
// show on a lock screen. `url` is where tapping it takes the baker (the service
// worker opens it).
export type PushPayload = { title: string; body: string; url: string };

// The outcome of one send: delivered, the device is gone for good (prune it), or
// a transient failure (leave it — best-effort).
export type PushSendResult = 'ok' | 'expired' | 'failed';

// Sends one notification to one device. The production one uses web-push + the
// VAPID keys; tests inject a fake that just records what would be sent.
export type PushSender = {
  send(sub: PushSubscriptionInput, payload: PushPayload): Promise<PushSendResult>;
};

// The production sender: signs and encrypts each notification with web-push and
// the VAPID keys. The VAPID details are read and applied lazily on first send
// (like the store adapters), so merely constructing this never needs the env.
export function createWebPushSender(): PushSender {
  let configured = false;
  function ensureConfigured(): void {
    if (configured) return;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      throw new Error(
        'Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT in server/.env',
      );
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }

  return {
    async send(sub, payload) {
      try {
        ensureConfigured();
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        return 'ok';
      } catch (err) {
        // 404/410 mean the browser dropped this subscription for good — prune it.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) return 'expired';
        return 'failed';
      }
    },
  };
}
