import type { CakeRequest, RequestDraft } from '../types';

// The server's address, set per environment in the frontend .env file.
function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// Loads every saved request from the server, newest first.
export async function loadRequests(): Promise<CakeRequest[]> {
  const res = await fetch(`${apiBase()}/api/requests`);
  if (!res.ok) throw new Error(`Could not load requests (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest[];
}

// Saves one new request and returns it with its database id + timestamp.
export async function saveRequest(draft: RequestDraft): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error(`Could not save request (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// Reserves a request for a baker (name + contact), returning the updated request.
export async function reserveRequest(
  id: string,
  name: string,
  contact: string,
): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, contact }),
  });
  if (!res.ok) throw new Error(`Could not reserve request (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// Cancels a reservation, returning the request back in its open state.
export async function releaseRequest(id: string): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Could not release request (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}
