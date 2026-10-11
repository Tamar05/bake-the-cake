// How much of a 1-hour hold is left. The server's `reservedUntil` is the source
// of truth; the browser clock only renders it. A missing deadline counts as
// expired so the box can never show a bogus time.
export function holdRemaining(
  reservedUntil: number | null,
  now: number,
): { expired: boolean; minutes: number; seconds: number } {
  if (reservedUntil == null || reservedUntil <= now) return { expired: true, minutes: 0, seconds: 0 };
  const ms = reservedUntil - now;
  return { expired: false, minutes: Math.floor(ms / 60000), seconds: Math.floor((ms % 60000) / 1000) };
}
