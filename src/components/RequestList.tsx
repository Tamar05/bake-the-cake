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
};

// The browse filter: everything, only open requests, or only reserved ones.
type Filter = 'all' | 'open' | 'reserved';

export default function RequestList({ t, language, requests, onUpdated }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  // Filter by the request's status (fresh from the server at load time). A
  // reservation that expires while the page sits open is a rare edge; a refresh
  // re-syncs it.
  const visible = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t.list.filterAll },
    { key: 'open', label: t.list.filterOpen },
    { key: 'reserved', label: t.list.filterReserved },
  ];

  return (
    <section className="request-list">
      <h2>{t.list.heading}</h2>

      <div className="list-filter" role="group" aria-label={t.list.heading}>
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

      {requests.length === 0 ? (
        <p className="empty">{t.list.empty}</p>
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
            />
          ))}
        </ul>
      )}
    </section>
  );
}
