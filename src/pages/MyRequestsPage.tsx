import RequestForm from '../components/RequestForm';
import RequestList from '../components/RequestList';
import { useAuth } from '../auth/AuthProvider';
import type { RequestDraft } from '../types';
import type { ListPageProps } from './types';

type Props = ListPageProps & { onAdd: (draft: RequestDraft) => void };

// The requester's home: the requests they own on top — each with a Cancel button
// to withdraw one they no longer need — then the form to ask for another cake
// below. Showing their own requests first keeps the page centred on what they've
// already asked for; the fresh form sits under it, ready for the next one. No
// browse filter; this list is already just theirs.
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
      <RequestForm t={t} onSubmit={onAdd} />
    </>
  );
}
