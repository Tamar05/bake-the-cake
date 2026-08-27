// The public inspiration gallery — no login required.

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// A gallery entry: just a photo and an optional caption. Never any names,
// location, or contact.
export type GalleryItem = {
  id: string;
  photoUrl: string;
  caption: string;
};

// Loads the public gallery of finished cakes that both the requester and baker
// agreed to share.
export async function getGallery(): Promise<GalleryItem[]> {
  const res = await fetch(`${apiBase()}/api/gallery`);
  if (!res.ok) throw new Error(`Could not load the gallery (HTTP ${res.status})`);
  return (await res.json()) as GalleryItem[];
}
