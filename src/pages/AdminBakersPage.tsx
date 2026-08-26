import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';
import { listBakers, setBakerVerified, type Baker } from '../lib/adminApi';

type Status = 'loading' | 'ready' | 'error';

// Admin-only screen: every baker with their verification state and a
// Verify / Unverify toggle. Only a verified baker may reserve and bake.
export default function AdminBakersPage({ t }: { t: Dictionary }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [bakers, setBakers] = useState<Baker[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setStatus('loading');
    listBakers(token)
      .then((list) => {
        setBakers(list);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  async function toggle(baker: Baker) {
    if (!token) return;
    setBusyId(baker.id);
    setErrorId(null);
    try {
      const updated = await setBakerVerified(baker.id, !baker.verified, token);
      setBakers((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch {
      setErrorId(baker.id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="request-list">
      <h2>{t.bakers.heading}</h2>
      {status === 'loading' && <p className="list-status">{t.bakers.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.bakers.loadError}</p>}
      {status === 'ready' &&
        (bakers.length === 0 ? (
          <p className="empty">{t.bakers.empty}</p>
        ) : (
          <ul className="baker-list">
            {bakers.map((baker) => (
              <li key={baker.id} className="baker-row">
                <div className="baker-info">
                  <strong>{baker.displayName}</strong>{' '}
                  <span
                    className={`baker-status ${baker.verified ? 'is-verified' : 'is-unverified'}`}
                  >
                    {baker.verified ? t.bakers.verifiedLabel : t.bakers.unverifiedLabel}
                  </span>
                  {baker.contact && (
                    <p className="baker-contact">
                      {t.bakers.contactPrefix} {baker.contact}
                    </p>
                  )}
                </div>
                <div className="baker-action">
                  <button type="button" onClick={() => toggle(baker)} disabled={busyId === baker.id}>
                    {busyId === baker.id
                      ? t.bakers.working
                      : baker.verified
                        ? t.bakers.unverify
                        : t.bakers.verify}
                  </button>
                  {errorId === baker.id && (
                    <p className="reserve-error">{t.bakers.actionError}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
