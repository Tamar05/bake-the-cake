// The signed-in person's profile, as our server reports it after verifying the
// login token. The role is the server's word, not the browser's.
export type Profile = {
  id: string;
  displayName: string;
  role: 'requester' | 'baker' | 'admin';
  contact: string | null;
  verified: boolean; // an admin has vetted this baker (only meaningful for bakers)
};

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// Asks our server "who am I?", passing the login token. The server verifies the
// token and looks up the role in the database.
export async function fetchMe(token: string): Promise<Profile> {
  const res = await fetch(`${apiBase()}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not load profile (HTTP ${res.status})`);
  return (await res.json()) as Profile;
}

// Redeems an invite code, flipping the signed-in account from baker to
// requester (organization). Throws on any failure — bad code, revoked code,
// or the account already being a requester/admin — the server never says
// which, so the caller shows one generic "not valid" message either way.
export async function joinAsOrganization(
  code: string,
  orgName: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code, orgName }),
  });
  if (!res.ok) throw new Error('INVALID_CODE');
}
