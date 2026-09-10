import { describe, it, expect } from 'vitest';
import { notifyMatchingBakers, buildRequestPushPayload } from './pushNotify';
import type { CakeRequest } from './types';
import type { PushSendResult } from './pushSender';

// A complete open request; override only what a test cares about.
function makeRequest(over: Partial<CakeRequest> = {}): CakeRequest {
  return {
    id: 'r1',
    recipient: 'Maya',
    occasion: '8th birthday',
    neededBy: '2026-09-01',
    dietary: '',
    location: 'Haifa',
    kashrut: 'Rabbanut',
    aboutRecipient: '',
    contactPhone: '+972501234567',
    createdAt: Date.now(),
    ownerId: 'user-req',
    status: 'open',
    reservedBy: null,
    reservedContact: null,
    reservedByUserId: null,
    reservedUntil: null,
    reservedAt: null,
    committedAt: null,
    deliveredAt: null,
    receivedAt: null,
    hasPhoto: false,
    sharedByOwner: false,
    sharedByBaker: false,
    galleryCaption: '',
    ...over,
  };
}

type Recipient = { id: string; homeTown: string; travelRadiusKm: number; dietary: string[]; kashrut: string[] };
type Sub = { userId: string; endpoint: string; p256dh: string; auth: string };

// A fake sender that records every send and lets a test decide the result (or
// throw) per endpoint.
function makeFakeSender() {
  const sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
  const sender = {
    sent,
    resultFor: (_endpoint: string): PushSendResult => 'ok',
    throwFor: (_endpoint: string): boolean => false,
    async send(sub: Sub, payload: { title: string; body: string; url: string }) {
      if (sender.throwFor(sub.endpoint)) throw new Error('network blip');
      sent.push({ endpoint: sub.endpoint, payload });
      return sender.resultFor(sub.endpoint);
    },
  };
  return sender;
}

// Assembles the narrow deps the fan-out needs, recording any removed subs.
function depsWith(
  recipients: Recipient[],
  subs: Sub[],
  sender: ReturnType<typeof makeFakeSender>,
  removed: { userId: string; endpoint: string }[] = [],
) {
  return {
    profilesStore: { async listNotifiableBakers() { return recipients; } },
    pushStore: {
      async getSubscriptionsForUsers(ids: string[]) {
        return subs.filter((s) => ids.includes(s.userId));
      },
      async removeSubscription(userId: string, endpoint: string) {
        removed.push({ userId, endpoint });
      },
    },
    pushSender: sender,
  };
}

describe('buildRequestPushPayload', () => {
  it('is non-sensitive: occasion + area only, tapping opens browse', () => {
    const payload = buildRequestPushPayload(makeRequest({ occasion: 'graduation', location: 'Tel Aviv' }));
    expect(payload.title).toContain('cake');
    expect(payload.body).toBe('graduation in Tel Aviv');
    expect(payload.url).toBe('/browse');
    // never leak private details
    expect(JSON.stringify(payload)).not.toContain('Maya');
    expect(JSON.stringify(payload)).not.toContain('+972');
  });
});

describe('notifyMatchingBakers', () => {
  const matchingRecipient: Recipient = {
    id: 'bak1',
    homeTown: 'Haifa',
    travelRadiusKm: 5,
    dietary: [],
    kashrut: ['Rabbanut'],
  };

  it('sends to a verified, opted-in baker whose capabilities match', async () => {
    const subs: Sub[] = [{ userId: 'bak1', endpoint: 'https://p/1', p256dh: 'x', auth: 'y' }];
    const sender = makeFakeSender();
    await notifyMatchingBakers(makeRequest(), depsWith([matchingRecipient], subs, sender));
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].endpoint).toBe('https://p/1');
    expect(sender.sent[0].payload.body).toBe('8th birthday in Haifa');
  });

  it('does not send to a baker whose capabilities do not match', async () => {
    // Tel Aviv is well outside a 5km radius of Haifa.
    const wrongArea: Recipient = {
      id: 'bak1',
      homeTown: 'Tel Aviv',
      travelRadiusKm: 5,
      dietary: [],
      kashrut: ['Rabbanut'],
    };
    const subs: Sub[] = [{ userId: 'bak1', endpoint: 'https://p/1', p256dh: 'x', auth: 'y' }];
    const sender = makeFakeSender();
    await notifyMatchingBakers(makeRequest(), depsWith([wrongArea], subs, sender));
    expect(sender.sent).toHaveLength(0);
  });

  it('sends to every device a matching baker has', async () => {
    const subs: Sub[] = [
      { userId: 'bak1', endpoint: 'https://p/1', p256dh: 'x', auth: 'y' },
      { userId: 'bak1', endpoint: 'https://p/2', p256dh: 'x', auth: 'y' },
    ];
    const sender = makeFakeSender();
    await notifyMatchingBakers(makeRequest(), depsWith([matchingRecipient], subs, sender));
    expect(sender.sent.map((s) => s.endpoint).sort()).toEqual(['https://p/1', 'https://p/2']);
  });

  it('does nothing when no baker matches', async () => {
    const sender = makeFakeSender();
    await notifyMatchingBakers(makeRequest(), depsWith([], [], sender));
    expect(sender.sent).toHaveLength(0);
  });

  it('does nothing when a matching baker has no devices', async () => {
    const sender = makeFakeSender();
    await notifyMatchingBakers(makeRequest(), depsWith([matchingRecipient], [], sender));
    expect(sender.sent).toHaveLength(0);
  });

  it('deletes a subscription the push service reports expired; others still get sent', async () => {
    const subs: Sub[] = [
      { userId: 'bak1', endpoint: 'https://p/gone', p256dh: 'x', auth: 'y' },
      { userId: 'bak1', endpoint: 'https://p/live', p256dh: 'x', auth: 'y' },
    ];
    const sender = makeFakeSender();
    sender.resultFor = (e) => (e === 'https://p/gone' ? 'expired' : 'ok');
    const removed: { userId: string; endpoint: string }[] = [];
    await notifyMatchingBakers(makeRequest(), depsWith([matchingRecipient], subs, sender, removed));
    expect(sender.sent).toHaveLength(2);
    expect(removed).toEqual([{ userId: 'bak1', endpoint: 'https://p/gone' }]);
  });

  it('a failed send is swallowed and does not delete the subscription', async () => {
    const subs: Sub[] = [{ userId: 'bak1', endpoint: 'https://p/1', p256dh: 'x', auth: 'y' }];
    const sender = makeFakeSender();
    sender.resultFor = () => 'failed';
    const removed: { userId: string; endpoint: string }[] = [];
    await expect(
      notifyMatchingBakers(makeRequest(), depsWith([matchingRecipient], subs, sender, removed)),
    ).resolves.toBeUndefined();
    expect(removed).toHaveLength(0);
  });

  it('one device throwing never stops the others (best-effort)', async () => {
    const subs: Sub[] = [
      { userId: 'bak1', endpoint: 'https://p/boom', p256dh: 'x', auth: 'y' },
      { userId: 'bak1', endpoint: 'https://p/ok', p256dh: 'x', auth: 'y' },
    ];
    const sender = makeFakeSender();
    sender.throwFor = (e) => e === 'https://p/boom';
    await expect(
      notifyMatchingBakers(makeRequest(), depsWith([matchingRecipient], subs, sender)),
    ).resolves.toBeUndefined();
    expect(sender.sent.map((s) => s.endpoint)).toEqual(['https://p/ok']);
  });
});
