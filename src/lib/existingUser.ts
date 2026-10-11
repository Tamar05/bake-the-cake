// Supabase doesn't return an error when someone signs up with an email that
// already has an account (it hides which emails exist). Instead it hands back
// a placeholder user whose `identities` list is empty, and sends no email.
// A genuinely new sign-up always has at least one identity.
export function isExistingUserResponse(
  user: { identities?: unknown[] | null } | null | undefined,
): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}
