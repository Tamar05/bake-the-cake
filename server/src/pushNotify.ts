import type { CakeRequest } from './types';
import type { ProfilesStore } from './profilesStore';
import type { PushStore } from './pushStore';
import type { PushSender, PushPayload } from './pushSender';
import { matchesCapabilities } from './matching';

// The notification a new request turns into. Only the occasion and area — the
// same non-sensitive facts the 🔔 bell shows — never the recipient's name or the
// contact phone.
export function buildRequestPushPayload(request: CakeRequest): PushPayload {
  return {
    title: 'New cake to bake 🎂',
    body: `${request.occasion} in ${request.location}`,
    url: '/browse',
  };
}

// The exact slices of the stores this fan-out needs — narrow, so it's easy to
// test and can't reach for anything else.
type NotifyDeps = {
  profilesStore: Pick<ProfilesStore, 'listNotifiableBakers'>;
  pushStore: Pick<PushStore, 'getSubscriptionsForUsers' | 'removeSubscription'>;
  pushSender: PushSender;
};

// Push a new request to every verified, opted-in baker whose capabilities match
// it, on each of their devices. Entirely best-effort: one device — or the whole
// push service — failing never throws and never affects request creation. A
// device the service reports gone is pruned, so the table self-heals.
export async function notifyMatchingBakers(request: CakeRequest, deps: NotifyDeps): Promise<void> {
  const { profilesStore, pushStore, pushSender } = deps;
  const recipients = (await profilesStore.listNotifiableBakers()).filter((baker) =>
    matchesCapabilities(request, baker),
  );
  if (recipients.length === 0) return;
  const subs = await pushStore.getSubscriptionsForUsers(recipients.map((r) => r.id));
  if (subs.length === 0) return;
  const payload = buildRequestPushPayload(request);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        const result = await pushSender.send(sub, payload);
        if (result === 'expired') await pushStore.removeSubscription(sub.userId, sub.endpoint);
      } catch {
        // best-effort: one device failing must never affect the others
      }
    }),
  );
}
