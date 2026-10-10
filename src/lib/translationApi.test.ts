import { describe, it, expect, vi, afterEach } from 'vitest';
import { translateText } from './translationApi';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(response: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('translationApi', () => {
  it('asks MyMemory for the right language pair and returns the translation', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ responseData: { translatedText: 'שלום' }, responseStatus: 200 }),
    });
    const result = await translateText('hello', 'he');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('https://api.mymemory.translated.net/get');
    expect(url).toContain('q=hello');
    expect(url).toContain('langpair=en|he');
    expect(url).toContain('de=tamatcakeproject%40gmail.com');
    expect(result).toBe('שלום');
  });

  it('translates Hebrew to English when the target is en', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ responseData: { translatedText: 'hello' } }),
    });
    await translateText('שלום', 'en');
    expect(fetchMock.mock.calls[0][0] as string).toContain('langpair=he|en');
  });

  it('throws on a non-OK response (e.g. 429 rate limit)', async () => {
    mockFetch({ ok: false, status: 429 });
    await expect(translateText('hello', 'he')).rejects.toThrow('HTTP 429');
  });

  it('throws when MyMemory reports an error inside a 200 response', async () => {
    mockFetch({
      ok: true,
      json: async () => ({ responseData: { translatedText: 'QUERY LENGTH LIMIT' }, responseStatus: 403 }),
    });
    await expect(translateText('hello', 'he')).rejects.toThrow('service status 403');
  });

  it('throws when no translated text comes back', async () => {
    mockFetch({ ok: true, json: async () => ({ responseData: {} }) });
    await expect(translateText('hello', 'he')).rejects.toThrow();
  });

  it('refuses empty or over-long text without calling the network', async () => {
    const fetchMock = mockFetch({ ok: true });
    await expect(translateText('   ', 'he')).rejects.toThrow();
    await expect(translateText('x'.repeat(501), 'he')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
