import { useSearchParams } from 'react-router-dom';
import RequestList, { type Filter } from '../components/RequestList';
import type { ListPageProps } from './types';

const ALL_FILTERS: Filter[] = ['all', 'open', 'reserved', 'committed', 'delivered', 'received'];

// The admin's manage-everything view: every request, with a status filter and
// full controls. An admin can release any reservation and delete any request
// (including the legacy anonymous ones nobody owns). A dashboard tile can
// deep-link here with ?status=<filter> to land already filtered.
export default function AdminPage({ t, language, requests, onUpdated, onDeleted }: ListPageProps) {
  const [searchParams] = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const initialFilter: Filter =
    requestedStatus && (ALL_FILTERS as string[]).includes(requestedStatus)
      ? (requestedStatus as Filter)
      : 'all';

  return (
    <RequestList
      // Remounts when the requested status changes (e.g. clicking a different
      // dashboard tile while already on this page), so initialFilter re-applies.
      key={initialFilter}
      t={t}
      language={language}
      requests={requests}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      heading={t.views.adminHeading}
      filterOptions={ALL_FILTERS}
      initialFilter={initialFilter}
    />
  );
}
