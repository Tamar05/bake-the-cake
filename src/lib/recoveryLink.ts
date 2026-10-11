// Supabase's "reset your password" email link carries `type=recovery` in the URL
// fragment (e.g. /#access_token=…&type=recovery). If the redirect address isn't
// on Supabase's allowed list it quietly falls back to the site's home page, so
// the app watches for this marker and moves the person to the reset form itself.
export function isRecoveryLink(hash: string): boolean {
  return /[#&]type=recovery(&|$)/.test(hash);
}
