import RequestList from '../components/RequestList';
import { useAuth } from '../auth/AuthProvider';
import type { ListPageProps } from './types';

// The public "shop window": every request, with the All/Open/Reserved filter.
// Signed-out visitors see it read-only (with a nudge to sign in); bakers get the
// Reserve button on open cards; admins get full controls. This is where a role's
// index redirect sends bakers to find cakes to bake.
export default function BrowsePage({ t, language, requests, onUpdated, onDeleted }: ListPageProps) {
  const { profile } = useAuth();
  return (
    <>
      {!profile && <p className="post-note">{t.nav.signInPrompt}</p>}
      <RequestList
        t={t}
        language={language}
        requests={requests}
        onUpdated={onUpdated}
        onDeleted={onDeleted}
      />
    </>
  );
}
