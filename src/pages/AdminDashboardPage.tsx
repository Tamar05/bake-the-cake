import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';
import { getStats, type Stats } from '../lib/adminApi';

type Status = 'loading' | 'ready' | 'error';

// One number in the grid: a big value with a label, optionally a small note
// (e.g. "3 verified"), and a highlight (the impact number) or warn tint.
function Tile({
  label,
  value,
  note,
  highlight,
  warn,
}: {
  label: string;
  value: number;
  note?: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`stat-tile${highlight ? ' stat-highlight' : ''}${warn ? ' stat-warn' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}

// Admin-only overview of the whole service, from data we already collect.
export default function AdminDashboardPage({ t }: { t: Dictionary }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!token) return;
    setStatus('loading');
    getStats(token)
      .then((s) => {
        setStats(s);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <section className="request-list">
      <h2>{t.dashboard.heading}</h2>
      {status === 'loading' && <p className="list-status">{t.dashboard.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.dashboard.loadError}</p>}
      {status === 'ready' && stats && (
        <div className="stat-grid">
          <Tile label={t.dashboard.total} value={stats.requests.total} />
          <Tile label={t.dashboard.open} value={stats.requests.open} />
          <Tile label={t.dashboard.reserved} value={stats.requests.reserved} />
          <Tile label={t.dashboard.baking} value={stats.requests.committed} />
          <Tile label={t.dashboard.delivered} value={stats.requests.delivered} />
          <Tile label={t.dashboard.fulfilled} value={stats.requests.received} highlight />
          <Tile
            label={t.dashboard.needsAttention}
            value={stats.needsAttention}
            warn={stats.needsAttention > 0}
          />
          <Tile
            label={t.dashboard.bakers}
            value={stats.bakers.total}
            note={`${stats.bakers.verified} ${t.dashboard.verifiedSuffix}`}
          />
        </div>
      )}
    </section>
  );
}
