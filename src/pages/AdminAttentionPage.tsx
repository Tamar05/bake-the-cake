import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';
import { listAttention, type AttentionItem } from '../lib/adminApi';
import { townLabel } from '../lib/optionLabels';

const REASON_LABEL = {
  overdue: (t: Dictionary) => t.attention.reasonOverdue,
  unclaimed: (t: Dictionary) => t.attention.reasonUnclaimed,
  'unrecognized-town': (t: Dictionary) => t.attention.reasonUnrecognizedTown,
} as const;

type Status = 'loading' | 'ready' | 'error';

// Admin-only screen: requests that look stuck — overdue (past their needed-by
// date, not yet delivered) or unclaimed (open with no baker for over a week) —
// each with the requester's contact so an admin can follow up by hand.
export default function AdminAttentionPage({ t }: { t: Dictionary }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!token) return;
    setStatus('loading');
    listAttention(token)
      .then((list) => {
        setItems(list);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <section className="request-list">
      <h2>{t.attention.heading}</h2>
      {status === 'loading' && <p className="list-status">{t.attention.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.attention.loadError}</p>}
      {status === 'ready' &&
        (items.length === 0 ? (
          <p className="empty">{t.attention.empty}</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id} className="request-card">
                <span className={`status-badge attention-${item.reason}`}>{REASON_LABEL[item.reason](t)}</span>
                <h3>{item.recipient}</h3>
                <p>{item.occasion}</p>
                <p>
                  {t.list.neededByPrefix} {item.neededBy}
                </p>
                <p>
                  {t.list.locationPrefix} {townLabel(item.location)}
                </p>
                <p className="attention-contact">
                  {t.attention.contactPrefix} {item.ownerContact ?? t.attention.noContact}
                </p>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
