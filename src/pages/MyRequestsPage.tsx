import RequestForm from '../components/RequestForm';
import RequestList from '../components/RequestList';
import { useAuth } from '../auth/AuthProvider';
import type { RequestDraft } from '../types';
import type { ListPageProps } from './types';

type Props = ListPageProps & { onAdd: (draft: RequestDraft) => void };

// The requester's home: the post form on top, then the requests they own — each
// with a Cancel button to withdraw one they no longer need. No browse filter;
// this list is already just theirs.
export default function MyRequestsPage({
  t,
  language,
  requests,
  onAdd,
  onUpdated,
  onDeleted,
}: Props) {
  const { profile } = useAuth();
  const mine = requests.filter((r) => r.ownerId === profile?.id);
  return (
    <>
      <RequestForm t={t} onAdd={onAdd} />
      <RequestList
        t={t}
        language={language}
        requests={mine}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
        heading={t.views.myRequestsHeading}
        emptyText={t.views.myRequestsEmpty}
        showFilter={false}
      />
    </>
  );
}
