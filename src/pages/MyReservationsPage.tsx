import RequestList from '../components/RequestList';
import { useAuth } from '../auth/AuthProvider';
import type { ListPageProps } from './types';

// The baker's home: the cakes they've actively reserved (their hold still
// running), with the release button + countdown on each. Once a hold expires the
// request drops out of this list and returns to the public browse view.
export default function MyReservationsPage({
  t,
  language,
  requests,
  onUpdated,
  onDeleted,
}: ListPageProps) {
  const { profile } = useAuth();
  const mine = requests.filter((r) => r.reservedByUserId === profile?.id);
  return (
    <RequestList
      t={t}
      language={language}
      requests={mine}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      heading={t.views.myReservationsHeading}
      emptyText={t.views.myReservationsEmpty}
      showFilter={false}
    />
  );
}
