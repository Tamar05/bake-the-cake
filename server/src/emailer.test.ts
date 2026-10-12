import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildCommitEmail, createResendEmailer, parseEmailLang } from './emailer';
import type { CakeRequest } from './types';

const request = {
  id: 'r1',
  recipient: 'Ruth Cohen',
  occasion: '8th birthday, dinosaurs',
  neededBy: '2026-11-01',
  dietary: 'nut-free, vegan',
  location: 'Haifa',
  kashrut: 'Rabbanut',
  aboutRecipient: 'Loves green and T-rex.',
  contactPhone: '+972501234567',
} as CakeRequest;

describe('buildCommitEmail', () => {
  it('includes the recipient name, phone and every cake detail (English)', () => {
    const { subject, text } = buildCommitEmail(request, 'en');
    expect(subject).toContain('Ruth Cohen');
    for (const part of [
      'Ruth Cohen',
      '+972501234567',
      '8th birthday, dinosaurs',
      '2026-11-01',
      'Haifa',
      'nut-free, vegan',
      'Rabbanut',
      'Loves green and T-rex.',
    ]) {
      expect(text).toContain(part);
    }
  });

  it('writes the Hebrew version when asked, still with name and phone', () => {
    const { subject, text } = buildCommitEmail(request, 'he');
    expect(/[֐-׿]/.test(subject)).toBe(true);
    expect(text).toContain('Ruth Cohen');
    expect(text).toContain('+972501234567');
  });

  it('tells the baker to contact the recipient by phone to arrange the exact location and delivery time', () => {
    expect(buildCommitEmail(request, 'en').text).toMatch(/call or message the recipient/i);
    expect(buildCommitEmail(request, 'en').text).toMatch(/exact location and delivery time/i);
    expect(buildCommitEmail(request, 'he').text).toContain('אנא צרו קשר עם מקבל/ת העוגה');
  });

  it('omits the dietary and note lines when empty, and never mentions an organization or link', () => {
    const { text } = buildCommitEmail({ ...request, dietary: '', aboutRecipient: '' }, 'en');
    expect(text).not.toMatch(/dietary/i);
    expect(text).not.toMatch(/about the recipient/i);
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/organi[sz]ation/i);
  });
});

describe('buildCommitEmail HTML copy', () => {
  it('is right-to-left in Hebrew and left-to-right in English', () => {
    expect(buildCommitEmail(request, 'he').html).toContain('dir="rtl"');
    expect(buildCommitEmail(request, 'en').html).toContain('dir="ltr"');
  });

  it('escapes user-written text so it cannot inject markup', () => {
    const { html } = buildCommitEmail({ ...request, aboutRecipient: '<b>hi</b> & bye' }, 'en');
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt; &amp; bye');
    expect(html).not.toContain('<b>hi</b>');
  });

  it('uses the same button names the baker sees in the app', () => {
    expect(buildCommitEmail(request, 'en').text).toContain('"My reservations"');
    expect(buildCommitEmail(request, 'en').text).toContain('"Mark delivered"');
    expect(buildCommitEmail(request, 'he').text).toContain('"השמירות שלי"');
    expect(buildCommitEmail(request, 'he').text).toContain('"סמנו כנמסרה"');
  });
});

describe('parseEmailLang', () => {
  it('accepts he, and falls back to en for anything else', () => {
    expect(parseEmailLang('he')).toBe('he');
    expect(parseEmailLang('en')).toBe('en');
    expect(parseEmailLang('fr')).toBe('en');
    expect(parseEmailLang(undefined)).toBe('en');
  });
});

describe('createResendEmailer', () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Bake the Cake <orders@bakethecake.org>';
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  it('POSTs to Resend with the key, an idempotency key and the message', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }));
    await createResendEmailer(fetchImpl as unknown as typeof fetch).sendCommitEmail({
      to: 'baz@example.com',
      lang: 'en',
      request,
      idempotencyKey: 'r1:123',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer re_test');
    expect(headers['Idempotency-Key']).toBe('r1:123');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('Bake the Cake <orders@bakethecake.org>');
    expect(body.to).toEqual(['baz@example.com']);
    expect(body.text).toContain('+972501234567');
    expect(body.html).toContain('+972501234567');
  });

  it('throws when Resend answers with an error status', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 403 }));
    await expect(
      createResendEmailer(fetchImpl as unknown as typeof fetch).sendCommitEmail({
        to: 'a@b.c',
        lang: 'en',
        request,
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/403/);
  });

  it('throws (without calling fetch) when the key or sender is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchImpl = vi.fn();
    await expect(
      createResendEmailer(fetchImpl as unknown as typeof fetch).sendCommitEmail({
        to: 'a@b.c',
        lang: 'en',
        request,
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/RESEND_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
