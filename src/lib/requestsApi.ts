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

// The baker who committed marks the cake delivered (committed → delivered),
// optionally attaching one finished-cake photo. With a photo we send multipart
// form-data (the browser sets the Content-Type + boundary itself); without one,
// a plain POST.
export async function deliverRequest(
  id: string,
  token: string,
  photo?: File | null,
): Promise<CakeRequest> {
  const init: RequestInit = { method: 'POST', headers: { Authorization: `Bearer ${token}` } };
  if (photo) {
    const form = new FormData();
    form.append('photo', photo);
    init.body = form;
  }
  const res = await fetch(`${apiBase()}/api/requests/${id}/deliver`, init);
  if (!res.ok) throw new Error(`Could not mark delivered (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// Fetches a short-lived signed URL for a request's finished-cake photo. The
// server only returns one to a viewer allowed to see it (owner / baker / admin).
export async function getPhotoUrl(id: string, token: string): Promise<string> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/photo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not load photo (HTTP ${res.status})`);
  const data = (await res.json()) as { url: string };
  return data.url;
}

// The requester or baker toggles their agreement to show a received cake in the
// public gallery, optionally setting the caption. Returns the updated request.
export async function setGalleryShare(
  id: string,
  share: boolean,
  token: string,
  caption?: string,
): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(caption === undefined ? { share } : { share, caption }),
  });
  if (!res.ok) throw new Error(`Could not update sharing (HTTP ${res.status})`);
  return (await res.json()) as CakeRequest;
}

// Admin moderation: remove a request's finished-cake photo. Returns the updated
// request (now with no photo).
export async function removePhoto(id: string, token: string): Promise<CakeRequest> {
  const res = await fetch(`${apiBase()}/api/requests/${id}/photo`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not remove photo (HTTP ${res.status})`);
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
