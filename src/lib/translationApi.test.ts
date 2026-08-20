import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateText } from './translationApi';

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://server.example');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('translationApi', () => {
  it('POSTs the text + target language and returns the translated string', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ translated: 'שלום' }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await translateText('hello', 'he');
    expect(fetchMock).toHaveBeenCalledWith('https://server.example/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello', to: 'he' }),
    });
    expect(result).toBe('שלום');
  });

  it('throws on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(translateText('hello', 'he')).rejects.toThrow();
  });
});
