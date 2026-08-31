import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  urlBase64ToUint8Array,
  sendPushSubscription,
  removePushSubscription,
  isPushSupported,
} from './pushApi';

const sub = { endpoint: 'https://push.example/dev-1', keys: { p256dh: 'p256', auth: 'authsecret' } };

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://server.example');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('urlBase64ToUint8Array', () => {
  it('decodes an unpadded base64url string to the right bytes', () => {
    // base64url "aGk" is "hi" → bytes [104, 105]. It needs one '=' of padding,
    // which the decoder must add back itself.
    expect(Array.from(urlBase64ToUint8Array('aGk'))).toEqual([104, 105]);
  });

  it('maps the url-safe - and _ back to + and /', () => {
    // Byte 0xFF 0xFE 0xFD is "//79" in standard base64 and "__79" in base64url.
    expect(Array.from(urlBase64ToUint8Array('__79'))).toEqual([255, 254, 253]);
  });
});

describe('isPushSupported', () => {
  it('is false in an environment without a service worker (the test runner)', () => {
    // node/vitest has no window/serviceWorker/PushManager, so the guard trips.
    expect(isPushSupported()).toBe(false);
  });
});

describe('sendPushSubscription', () => {
  it('POSTs the subscription with the auth token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await sendPushSubscription(sub, 'tkn');
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/me/push-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tkn' },
      body: JSON.stringify(sub),
    });
  });

  it('throws when the server refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(sendPushSubscription(sub, 'tkn')).rejects.toThrow();
  });
});

describe('removePushSubscription', () => {
  it('DELETEs the endpoint with the auth token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await removePushSubscription(sub.endpoint, 'tkn');
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/me/push-subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tkn' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  });

  it('throws when the server refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(removePushSubscription(sub.endpoint, 'tkn')).rejects.toThrow();
  });
});
