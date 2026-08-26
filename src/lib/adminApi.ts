// Admin-only calls for the baker verification screen.

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// A baker as the admin sees them in the verification list.
export type Baker = {
  id: string;
  displayName: string;
  contact: string | null;
  verified: boolean;
  createdAt: number;
};

// Lists every baker with their verification state (admin only).
export async function listBakers(token: string): Promise<Baker[]> {
  const res = await fetch(`${apiBase()}/api/bakers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not load bakers (HTTP ${res.status})`);
  return (await res.json()) as Baker[];
}

// Verifies or unverifies a baker (admin only). Only a verified baker may reserve.
export async function setBakerVerified(
  id: string,
  verified: boolean,
  token: string,
): Promise<Baker> {
  const res = await fetch(`${apiBase()}/api/bakers/${id}/verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ verified }),
  });
  if (!res.ok) throw new Error(`Could not update baker (HTTP ${res.status})`);
  return (await res.json()) as Baker;
}
