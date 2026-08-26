// Admin-only calls for the baker verification and needs-attention screens.
import type { CakeRequest } from '../types';

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

// A stuck request the admin should look at, with why and the requester's contact.
export type AttentionItem = CakeRequest & {
  reason: 'overdue' | 'unclaimed';
  ownerContact: string | null;
};

// Lists requests that need an admin's attention (admin only).
export async function listAttention(token: string): Promise<AttentionItem[]> {
  const res = await fetch(`${apiBase()}/api/attention`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not load attention list (HTTP ${res.status})`);
  return (await res.json()) as AttentionItem[];
}

// A small overview of the whole service, for the admin dashboard.
export type Stats = {
  requests: {
    total: number;
    open: number;
    reserved: number;
    committed: number;
    delivered: number;
    received: number;
  };
  bakers: { total: number; verified: number };
  needsAttention: number;
};

export async function getStats(token: string): Promise<Stats> {
  const res = await fetch(`${apiBase()}/api/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not load stats (HTTP ${res.status})`);
  return (await res.json()) as Stats;
}
