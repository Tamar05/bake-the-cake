// Turns Supabase's email-related auth errors into something a person can act on.
// Supabase reports these with a machine `code` and an English `message`; we check
// both because older responses only carry the message.
export type EmailProblem = 'invalid' | 'tooMany';

export function emailProblem(err: unknown): EmailProblem | null {
  if (typeof err !== 'object' || err === null) return null;
  const { code, message } = err as { code?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message : '';
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(text)) return 'tooMany';
  if (code === 'email_address_invalid' || /email address .* is invalid/i.test(text)) return 'invalid';
  return null;
}
