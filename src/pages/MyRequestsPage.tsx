import RequestList from '../components/RequestList';
import { useAuth } from '../auth/AuthProvider';
import type { ListPageProps } from './types';

type Props = ListPageProps;

// The requester's home: the requests they own, each with a Cancel button to
// withdraw one they no longer need. Posting a fresh one lives on its own
// "Request a cake" tab (see NewRequestPage) rather than as a form buried below
// this list. A coordinator managing many requests (for different
// beneficiaries) gets a search box, status tabs with live counts, and
// soonest-due-first sorting instead of the plain all/open/reserved browse filter.
export default function MyRequestsPage({ t, language, requests, onUpdated, onDeleted }: Props) {
  const { profile } = useAuth();
  const mine = requests.filter((r) => r.ownerId === profile?.id);
  return (
    <RequestList
      t={t}
      language={language}
      requests={mine}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
      heading={t.views.myRequestsHeading}
      emptyText={t.views.myRequestsEmpty}
      coordinatorView
    />
  );
}
