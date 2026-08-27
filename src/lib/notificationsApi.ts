// A baker's in-app notification settings (matches the server's shape).
export type NotificationSettings = {
  notifyNewRequests: boolean;
  areas: string[];
  dietary: string[];
  kashrut: string[];
  seenAt: number | null; // ms since 1970, or null if the bell was never opened
};

// The part a baker edits on the settings screen (seenAt is managed by the bell).
export type NotificationPrefs = Omit<NotificationSettings, 'seenAt'>;

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL;
}

// Reads the signed-in baker's own notification settings.
export async function getNotificationSettings(token: string): Promise<NotificationSettings> {
  const res = await fetch(`${apiBase()}/api/me/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Could not load settings (HTTP ${res.status})`);
  return (await res.json()) as NotificationSettings;
}

// Saves the signed-in baker's notification preferences.
export async function saveNotificationSettings(
  prefs: NotificationPrefs,
  token: string,
): Promise<NotificationSettings> {
  const res = await fetch(`${apiBase()}/api/me/notifications`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`Could not save settings (HTTP ${res.status})`);
  return (await res.json()) as NotificationSettings;
}
