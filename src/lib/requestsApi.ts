import type { CakeRequest, RequestDraft } from '../types';

// The server's address, set per environment in the frontend .env file.
function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// Loads every saved request from the server, newest first. If a login token is
// passed, the server reveals reserver details on requests this viewer is allowed
// to see (their own reservations, and requests they posted).
export async function loadRequests(token?: string): Promise<CakeRequest[]> {
  const res = await fetch(`${apiBase()}/api/requests`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load requests (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest[];
}

// Saves one new request and returns it with its database id + timestamp. The
// login token is sent so the server can record who owns it (and check the
// person is allowed to post).
export async function saveRequest(draft: RequestDraft, token: string): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error(`Could not save request (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// Reserves a request for the signed-in baker. Their name + contact come from
// their account on the server, so no details are sent here — just the token.
export async function reserveRequest(id: string, token: string): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/reserve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not reserve request (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// The reserving baker commits to bake a request they're holding, turning the
// 1-hour hold into a lasting claim. The server checks it's really their
// reservation and that it's still in the reserved state.
export async function commitRequest(id: string, token: string): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not commit to request (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// The baker who committed marks the cake delivered (committed → delivered).
export async function deliverRequest(id: string, token: string): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/deliver`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not mark delivered (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// The requester who owns it confirms they received the cake (delivered →
// received), closing the loop.
export async function receiveRequest(id: string, token: string): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/receive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not confirm receipt (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// Cancels a reservation, returning the request to its open state.
export async function releaseRequest(id: string, token: string): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/release`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not release request (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// Deletes a request for good. The server only allows the owner (cancelling their
// own) or an admin (removing anything); anyone else gets a 403. Nothing comes
// back on success (HTTP 204) — the caller drops the request from its own list.
export async function deleteRequest(id: string, token: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/requests/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not delete request (HTTP ${res.status})`);
}
