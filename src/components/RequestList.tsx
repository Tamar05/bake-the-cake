import { Fragment, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import RequestCard from './RequestCard';
import {
  countByTab,
  dueFlag,
  filterByTab,
  matchesSearch,
  sortByNeededBy,
  type StatusTab,
} from '../lib/myRequests';

type Props = {
  t: Dictionary;
  language: Language;
  requests: CakeRequest[];
  onUpdated: (updated: CakeRequest) => void;
  onDeleted: (id: string) => void;
  heading?: string; // overrides the default "Open requests" heading
  emptyText?: string; // overrides the default "no requests yet" message
  showFilter?: boolean; // whether to show the status filter (default true)
  // Which filter buttons to show, and in what order (default: All/Open/Reserved,
  // the browse-style set). The admin view passes the full status list so a
  // dashboard tile can deep-link straight to e.g. "Baking".
  filterOptions?: Filter[];
  // Pre-selects a filter on first render (e.g. from a dashboard tile's link).
  // Ignored once the user picks a different one.
  initialFilter?: Filter;
  // Turns on the view a coordinator managing many requests needs: a search box,
  // All/Open/In progress/Done tabs with live counts, soonest-needed-by-first
  // sorting, and an overdue/due-soon flag on each card. Overrides showFilter.
  coordinatorView?: boolean;
};

// The status filter: everything, or one specific status.
export type Filter = 'all' | CakeRequest['status'];

const DEFAULT_FILTER_OPTIONS: Filter[] = ['all', 'open', 'reserved'];

export default function RequestList({
  t,
  language,
  requests,
  onUpdated,
  onDeleted,
  heading,
  emptyText,
  showFilter = true,
  filterOptions = DEFAULT_FILTER_OPTIONS,
  initialFilter = 'all',
  coordinatorView = false,
}: Props) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [tab, setTab] = useState<StatusTab>('all');
  const [query, setQuery] = useState('');

  // Filter by the request's status (fresh from the server at load time). A
  // reservation that expires while the page sits open is a rare edge; a refresh
  // re-syncs it. When the filter is hidden the full list is always shown.
  const visible = coordinatorView
    ? sortByNeededBy(filterByTab(requests, tab).filter((r) => matchesSearch(r, query)))
    : !showFilter || filter === 'all'
      ? requests
      : requests.filter((r) => r.status === filter);

  const listHeading = heading ?? t.list.heading;
  const emptyMessage = emptyText ?? t.list.empty;

  const filterLabels: Record<Filter, string> = {
    all: t.list.filterAll,
    open: t.list.filterOpen,
    reserved: t.list.filterReserved,
    committed: t.list.statusBaking,
    delivered: t.list.statusDelivered,
    received: t.list.statusReceived,
  };
  const filters: { key: Filter; label: string }[] = filterOptions.map((key) => ({
    key,
    label: filterLabels[key],
  }));

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'all', label: t.myRequests.tabAll },
    { key: 'open', label: t.myRequests.tabOpen },
    { key: 'inProgress', label: t.myRequests.tabInProgress },
    { key: 'done', label: t.myRequests.tabDone },
  ];

  const counts = coordinatorView ? countByTab(requests) : null;
  const now = Date.now();

  return (
    <section className="request-list">
      <h2>{listHeading}</h2>

      {coordinatorView && (
        <>
          <input
            type="search"
            className="my-requests-search"
            aria-label={t.myRequests.searchLabel}
            placeholder={t.myRequests.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {counts && (
            <p className="my-requests-tally">
              {counts.all} {t.myRequests.tallyRequests} · {counts.open} {t.myRequests.tallyOpen} ·{' '}
              {counts.inProgress} {t.myRequests.tallyInProgress} · {counts.done} {t.myRequests.tallyDone}
            </p>
          )}
        </>
      )}

      {coordinatorView ? (
        <div className="list-filter" role="group" aria-label={listHeading}>
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              className={tab === tb.key ? 'active' : undefined}
              aria-pressed={tab === tb.key}
              onClick={() => setTab(tb.key)}
            >
              {tb.label}
            </button>
          ))}
        </div>
      ) : (
        showFilter && (
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
        )
      )}

      {requests.length === 0 ? (
        <p className="empty">{emptyMessage}</p>
      ) : visible.length === 0 ? (
        <p className="empty">{t.list.filterEmpty}</p>
      ) : (
        <ul>
          {visible.map((request) => {
            const flag = coordinatorView ? dueFlag(request, now) : null;
            return (
              <Fragment key={request.id}>
                {flag && (
                  <li className={`due-flag due-flag-${flag}`}>
                    {flag === 'overdue' ? t.myRequests.dueOverdue : t.myRequests.dueSoon}
                  </li>
                )}
                <RequestCard
                  t={t}
                  language={language}
                  request={request}
                  onUpdated={onUpdated}
                  onDeleted={onDeleted}
                />
              </Fragment>
            );
          })}
        </ul>
      )}
    </section>
  );
}
