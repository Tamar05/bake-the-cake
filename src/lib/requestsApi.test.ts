import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRequests, saveRequest } from './requestsApi';
import type { RequestDraft } from '../types';

const draft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
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
});
