import { Resend } from 'resend';

// Everything a baker needs in their "you're baking this" email.
export type BakeEmailDetails = {
  bakerName: string;
  recipient: string;
  occasion: string;
  neededBy: string;
  dietary: string;
  location: string;
  requesterContact: string | null;
  requestId: string; // used for the idempotency key
};

// Sends baker notifications. The real one uses Resend; tests inject a fake with
// the same shape. Every method is best-effort at the call site — a failure to
// email must never break the action that triggered it.
export type Notifier = {
  sendBakeConfirmation(to: string, details: BakeEmailDetails): Promise<void>;
};

// The production notifier. If RESEND_API_KEY isn't set it quietly no-ops, so the
// app runs fine before email is configured. Uses the Resend sandbox sender by
// default (onboarding@resend.dev), which can only deliver to your own Resend
// account email until you verify a domain (set EMAIL_FROM once you have one).
export function createResendNotifier(): Notifier {
  return {
    async sendBakeConfirmation(to: string, details: BakeEmailDetails): Promise<void> {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return; // email not configured yet → skip
      const from = process.env.EMAIL_FROM ?? 'Bake the Cake <onboarding@resend.dev>';
      const resend = new Resend(apiKey);

      const dietaryLine = details.dietary ? `Dietary needs: ${details.dietary}\n` : '';
      const contactLine = details.requesterContact
        ? `How to reach the requester: ${details.requesterContact}\n`
        : 'How to reach the requester: (none on file — an admin can help)\n';

      // The SDK returns { data, error } and does NOT throw on API errors.
      const { error } = await resend.emails.send(
        {
          from,
          to,
          subject: `You're baking a cake for ${details.recipient} 🍰`,
          text:
            `Hi ${details.bakerName},\n\n` +
            `Thank you for offering to bake this cake! Here's everything you need:\n\n` +
            `For: ${details.recipient}\n` +
            `Occasion: ${details.occasion}\n` +
            `Needed by: ${details.neededBy}\n` +
            dietaryLine +
            `Location: ${details.location}\n` +
            contactLine +
            `\nPlease reach out to the requester to arrange delivery. ` +
            `Thank you for your kindness! 💛\n\n— Bake the Cake\n`,
        },
        { idempotencyKey: `bake-commit/${details.requestId}` },
      );
      if (error) console.error('Resend send failed:', error.message);
    },
  };
}
