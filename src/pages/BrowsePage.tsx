import RequestList from '../components/RequestList';
import { useAuth } from '../auth/AuthProvider';
import type { ListPageProps } from './types';

// The public "shop window": the cakes still up for grabs — open ones and those
// on a short reservation hold. Once a baker commits ("I'll bake this"), the cake
// leaves this list so other bakers don't see one that's already being baked; the
// baker who took it still finds it under "My reservations", and the requester
// under "My requests". Signed-out visitors see it read-only (with a nudge to
// sign in); bakers get the Reserve button on open cards.
export default function BrowsePage({ t, language, requests, onUpdated, onDeleted }: ListPageProps) {
  const { profile } = useAuth();
  const available = requests.filter((r) => r.status === 'open' || r.status === 'reserved');
  return (
    <>
      {!profile && <p className="post-note">{t.nav.signInPrompt}</p>}
      <RequestList
        t={t}
        language={language}
        requests={available}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
    </>
  );
}
