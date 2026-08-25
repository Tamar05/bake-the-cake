import { useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import RequestCard from './RequestCard';

type Props = {
  t: Dictionary;
  language: Language;
  requests: CakeRequest[];
  onUpdated: (updated: CakeRequest) => void;
  onDeleted: (id: string) => void;
  heading?: string; // overrides the default "Open requests" heading
  emptyText?: string; // overrides the default "no requests yet" message
  showFilter?: boolean; // whether to show the All/Open/Reserved filter (default true)
};

// The browse filter: everything, only open requests, or only reserved ones.
type Filter = 'all' | 'open' | 'reserved';

export default function RequestList({
  t,
  language,
  requests,
  onUpdated,
  onDeleted,
  heading,
  emptyText,
  showFilter = true,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  // Filter by the request's status (fresh from the server at load time). A
  // reservation that expires while the page sits open is a rare edge; a refresh
  // re-syncs it. When the filter is hidden the full list is always shown.
  const visible =
    !showFilter || filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  const listHeading = heading ?? t.list.heading;
  const emptyMessage = emptyText ?? t.list.empty;

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t.list.filterAll },
    { key: 'open', label: t.list.filterOpen },
    { key: 'reserved', label: t.list.filterReserved },
  ];

  return (
    <section className="request-list">
      <h2>{listHeading}</h2>

      {showFilter && (
        <div className="list-filter" role="group" aria-label={listHeading}>
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? 'active' : undefined}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="empty">{emptyMessage}</p>
      ) : visible.length === 0 ? (
        <p className="empty">{t.list.filterEmpty}</p>
      ) : (
        <ul>
          {visible.map((request) => (
            <RequestCard
              key={request.id}
              t={t}
              language={language}
              request={request}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
