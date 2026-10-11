import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRequests, saveRequest, deleteRequest, commitRequest, resendDetails } from './requestsApi';
import type { RequestDraft } from '../types';

const draft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
  kashrut: 'Rabbanut',
  aboutRecipient: '',
  contactPhone: '050-1234567',
};

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://server.example');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('requestsApi', () => {
  it('loadRequests GETs the server and returns the parsed array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);
    const result = await loadRequests();
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests', { headers: {} });
    expect(result).toEqual([]);
  });

  it('saveRequest POSTs the draft with the auth token and returns the saved request', async () => {
    const saved = { ...draft, id: 'x', createdAt: 1 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => saved });
    vi.stubGlobal('fetch', fetchMock);
    const result = await saveRequest(draft, 'token-123');
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123',
      },
      body: JSON.stringify(draft),
    });
    expect(result).toEqual(saved);
  });

  it('loadRequests throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(loadRequests()).rejects.toThrow();
  });

  it('deleteRequest sends a DELETE with the auth token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await deleteRequest('req-9', 'token-123');
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests/req-9', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-123' },
    });
  });

  it('deleteRequest throws when the server refuses (e.g. 403)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(deleteRequest('req-9', 'token-123')).rejects.toThrow();
  });

  it('commitRequest sends the language and returns the request plus emailSent', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'id1', status: 'committed', emailSent: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await commitRequest('id1', 'tok', 'he');
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests/id1/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ lang: 'he' }),
    });
    expect(result.emailSent).toBe(true);
    expect(result.request.id).toBe('id1');
    expect(result.request).not.toHaveProperty('emailSent');
  });

  it('commitRequest throws on a non-2xx answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({}) }));
    await expect(commitRequest('id1', 'tok', 'en')).rejects.toThrow(/409/);
  });

  it('resendDetails POSTs the language and resolves on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ emailSent: true }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(resendDetails('id1', 'tok', 'en')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/requests/id1/resend-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ lang: 'en' }),
    });
  });

  it('resendDetails throws when the server cannot send (502)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    await expect(resendDetails('id1', 'tok', 'en')).rejects.toThrow(/502/);
  });
});
