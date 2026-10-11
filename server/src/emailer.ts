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

// Plain, short, human text. Dietary and note lines appear only when filled in.
// Option values (dietary / kashrut) are the stored English identifiers.
export function buildCommitEmail(
  request: CakeRequest,
  lang: EmailLang,
): { subject: string; text: string } {
  const detail = (label: string, value: string) => `${label}: ${value}`;
  if (lang === 'he') {
    const lines = [
      'תודה שבחרתם לאפות את העוגה! הנה הפרטים לתיאום המסירה:',
      '',
      detail('שם מקבל/ת העוגה', request.recipient),
      detail('טלפון', request.contactPhone),
      '',
      detail('אירוע', request.occasion),
      detail('נדרשת בתאריך', request.neededBy),
      detail('אזור', request.location),
      detail('כשרות', request.kashrut),
    ];
    if (request.dietary) lines.push(detail('צרכים תזונתיים', request.dietary));
    if (request.aboutRecipient) lines.push('', detail('קצת על מקבל/ת העוגה', request.aboutRecipient));
    lines.push(
      '',
      'אנא צרו קשר עם מקבל/ת העוגה בטלפון שלמעלה כדי לתאם את המיקום המדויק ואת שעת המסירה.',
      '',
      'אחרי שמסרתם את העוגה, עדכנו את האתר:',
      '1. היכנסו ל-Bake the Cake ופתחו בתפריט את "My reservations" (ההזמנות שלי).',
      '2. בעוגה הזו לחצו על "סמנו כנמסרה" (אפשר להוסיף קודם תמונה של העוגה, לא חובה).',
      '',
      'בהצלחה, ותודה!',
    );
    return { subject: `פרטי המסירה לעוגה של ${request.recipient}`, text: lines.join('\n') };
  }
  const lines = [
    'Thank you for choosing to bake this cake! Here are the details to arrange delivery:',
    '',
    detail('Recipient', request.recipient),
    detail('Phone', request.contactPhone),
    '',
    detail('Occasion', request.occasion),
    detail('Needed by', request.neededBy),
    detail('Location', request.location),
    detail('Kashrut', request.kashrut),
  ];
  if (request.dietary) lines.push(detail('Dietary needs', request.dietary));
  if (request.aboutRecipient) lines.push('', detail('About the recipient', request.aboutRecipient));
  lines.push(
    '',
    'Please call or message the recipient on the phone number above to agree on the exact location and delivery time.',
    '',
    'Once you have delivered the cake, please let the site know:',
    '1. Sign in to Bake the Cake and open "My reservations" in the menu.',
    '2. Find this cake and press "Mark delivered" (you can add a photo of the cake first, but it is optional).',
    '',
    'Good luck, and thank you!',
  );
  return { subject: `Delivery details for ${request.recipient}'s cake`, text: lines.join('\n') };
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
      const { subject, text } = buildCommitEmail(request, lang);
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    },
  };
}
