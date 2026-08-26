import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRequests, saveRequest, deleteRequest } from './requestsApi';
import type { RequestDraft } from '../types';

const draft: RequestDraft = {
  recipient: 'Maya',
  occasion: '8th birthday',
  neededBy: '2026-09-01',
  dietary: '',
  location: 'Haifa',
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
});
