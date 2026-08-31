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
  const signedIn = profile != null;
  // Open cakes show to everyone; those on a short reservation hold show only to
  // signed-in bakers/admins. A signed-out visitor sees just the open ones — a
  // reserved cake is already in a baker's hands, so there's nothing for a browser
  // to act on there until they sign in.
  const available = requests.filter(
    (r) => r.status === 'open' || (signedIn && r.status === 'reserved'),
  );
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
