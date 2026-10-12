import type { CakeRequest } from './types';

export type EmailLang = 'en' | 'he';

export type CommitEmailInput = {
  to: string;
  lang: EmailLang;
  request: CakeRequest; // the UNREDACTED row — it carries the name and phone
  idempotencyKey: string;
};

// What the endpoints need to send the "you're baking this cake" email. The real
// one talks to Resend; tests inject a fake. Throws on ANY failure so the caller
// can report `emailSent: false` — a failed email never undoes a commit.
export type Emailer = {
  sendCommitEmail(input: CommitEmailInput): Promise<void>;
};

export function parseEmailLang(value: unknown): EmailLang {
  return value === 'he' ? 'he' : 'en';
}

export type CommitEmail = { subject: string; text: string; html: string };

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

type Copy = {
  dir: 'ltr' | 'rtl';
  subject: (recipient: string) => string;
  thanks: string;
  step1: string;
  recipient: string;
  phone: string;
  contactInstruction: string;
  detailsHeading: string;
  occasion: string;
  neededBy: string;
  location: string;
  kashrut: string;
  dietary: string;
  about: string;
  step2: string;
  afterSteps: string[];
  closing: string;
};

// The wording matches the labels the baker sees in the app in the same language
// ("My reservations" / "Mark delivered"), so the steps can be followed word for word.
const COPY: Record<EmailLang, Copy> = {
  en: {
    dir: 'ltr',
    subject: (recipient) => `Delivery details for ${recipient}'s cake`,
    thanks: 'Thank you for choosing to bake this cake!',
    step1: 'Step 1: Arrange the delivery',
    recipient: 'Recipient',
    phone: 'Phone',
    contactInstruction:
      'Please call or message the recipient on the phone number above to agree on the exact location and delivery time.',
    detailsHeading: 'The cake',
    occasion: 'Occasion',
    neededBy: 'Needed by',
    location: 'Location',
    kashrut: 'Kashrut',
    dietary: 'Dietary needs',
    about: 'About the recipient',
    step2: 'Step 2: After you deliver the cake',
    afterSteps: [
      'Sign in to Bake the Cake.',
      'Open "My reservations" in the menu.',
      'Find this cake and press "Mark delivered". Adding a photo of the cake first is optional.',
    ],
    closing: 'Good luck, and thank you!',
  },
  he: {
    dir: 'rtl',
    subject: (recipient) => `פרטי המסירה לעוגה של ${recipient}`,
    thanks: 'תודה שבחרתם לאפות את העוגה!',
    step1: 'שלב 1: מתאמים את המסירה',
    recipient: 'שם מקבל/ת העוגה',
    phone: 'טלפון',
    contactInstruction:
      'אנא צרו קשר עם מקבל/ת העוגה בטלפון שלמעלה כדי לתאם את המיקום המדויק ואת שעת המסירה.',
    detailsHeading: 'פרטי העוגה',
    occasion: 'אירוע',
    neededBy: 'נדרשת בתאריך',
    location: 'אזור',
    kashrut: 'כשרות',
    dietary: 'צרכים תזונתיים',
    about: 'קצת על מקבל/ת העוגה',
    step2: 'שלב 2: אחרי שמסרתם את העוגה',
    afterSteps: [
      'היכנסו ל"להכין את העוגה".',
      'פתחו בתפריט את "השמירות שלי".',
      'מצאו את העוגה הזו ולחצו על "סמנו כנמסרה". אפשר להוסיף קודם תמונה של העוגה, אבל זה לא חובה.',
    ],
    closing: 'בהצלחה, ותודה!',
  },
};

// A clear two-step email: (1) who to contact and the cake's details, (2) what to
// press on the site once delivered. Sent as plain text plus an HTML copy (the HTML
// one is right-to-left for Hebrew, so numbers and English words don't jumble).
// Dietary and note lines appear only when filled in. Option values (dietary /
// kashrut) are the stored English identifiers.
export function buildCommitEmail(request: CakeRequest, lang: EmailLang): CommitEmail {
  const c = COPY[lang];
  const facts: [string, string][] = [
    [c.occasion, request.occasion],
    [c.neededBy, request.neededBy],
    [c.location, request.location],
    [c.kashrut, request.kashrut],
  ];
  if (request.dietary) facts.push([c.dietary, request.dietary]);
  if (request.aboutRecipient) facts.push([c.about, request.aboutRecipient]);

  const text = [
    c.thanks,
    '',
    c.step1,
    `${c.recipient}: ${request.recipient}`,
    `${c.phone}: ${request.contactPhone}`,
    c.contactInstruction,
    '',
    c.detailsHeading,
    ...facts.map(([label, value]) => `${label}: ${value}`),
    '',
    c.step2,
    ...c.afterSteps.map((step, i) => `${i + 1}. ${step}`),
    '',
    c.closing,
  ].join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#7a5a5a;vertical-align:top">${escapeHtml(label)}</td>` +
    `<td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`;
  const heading = (label: string) =>
    `<h2 style="margin:24px 0 8px;font-size:18px;color:#d6456a">${escapeHtml(label)}</h2>`;
  const html =
    `<div dir="${c.dir}" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#3c2a2a;max-width:560px">` +
    `<p style="font-size:18px;margin:0 0 8px">${escapeHtml(c.thanks)}</p>` +
    heading(c.step1) +
    `<table style="border-collapse:collapse">${row(c.recipient, request.recipient)}${row(c.phone, request.contactPhone)}</table>` +
    `<p style="margin:8px 0 0">${escapeHtml(c.contactInstruction)}</p>` +
    heading(c.detailsHeading) +
    `<table style="border-collapse:collapse">${facts.map(([l, v]) => row(l, v)).join('')}</table>` +
    heading(c.step2) +
    `<ol style="margin:0;padding-${c.dir === 'rtl' ? 'right' : 'left'}:22px">${c.afterSteps
      .map((s) => `<li style="margin:4px 0">${escapeHtml(s)}</li>`)
      .join('')}</ol>` +
    `<p style="margin:24px 0 0">${escapeHtml(c.closing)}</p>` +
    `</div>`;

  return { subject: c.subject(request.recipient), text, html };
}

// The production emailer: Resend's REST API over fetch (no SDK dependency).
// RESEND_API_KEY and EMAIL_FROM are read at send time so a missing value is a
// clear per-email failure, not a crash at server start.
export function createResendEmailer(fetchImpl: typeof fetch = fetch): Emailer {
  return {
    async sendCommitEmail({ to, lang, request, idempotencyKey }) {
      const key = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;
      if (!key) throw new Error('Missing RESEND_API_KEY');
      if (!from) throw new Error('Missing EMAIL_FROM');
      const { subject, text, html } = buildCommitEmail(request, lang);
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    },
  };
}
