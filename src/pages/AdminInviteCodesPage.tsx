import { useEffect, useState, type FormEvent } from 'react';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';
import {
  listInviteCodes,
  createInviteCode,
  revokeInviteCode,
  type InviteCode,
} from '../lib/adminApi';

type Status = 'loading' | 'ready' | 'error';

const NOTE_MAX = 80;

// Admin-only screen: create, list, and revoke the invite codes that let an
// account become a requester (organization) via /join. A code can be
// redeemed by more than one account — revoking is the only way to stop it.
export default function AdminInviteCodesPage({ t }: { t: Dictionary }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setStatus('loading');
    listInviteCodes(token)
      .then((list) => {
        setCodes(list);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setCreating(true);
    setCreateError(false);
    try {
      const created = await createInviteCode(note.trim().slice(0, NOTE_MAX), token);
      setCodes((prev) => [created, ...prev]);
      setNote('');
    } catch {
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(codeItem: InviteCode) {
    if (!token || !window.confirm(t.inviteCodes.confirmRevoke)) return;
    setBusyId(codeItem.id);
    setErrorId(null);
    try {
      const updated = await revokeInviteCode(codeItem.id, token);
      setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch {
      setErrorId(codeItem.id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="request-list">
      <h2>{t.inviteCodes.heading}</h2>
      <p className="join-intro">{t.inviteCodes.intro}</p>
      <form className="invite-create-form" onSubmit={handleCreate}>
        <label>
          {t.inviteCodes.noteLabel}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            placeholder={t.inviteCodes.notePlaceholder}
          />
        </label>
        <button type="submit" disabled={creating}>
          {creating ? t.inviteCodes.creating : t.inviteCodes.create}
        </button>
        {createError && <p className="reserve-error">{t.inviteCodes.createError}</p>}
      </form>
      {status === 'loading' && <p className="list-status">{t.inviteCodes.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.inviteCodes.loadError}</p>}
      {status === 'ready' &&
        (codes.length === 0 ? (
          <p className="empty">{t.inviteCodes.empty}</p>
        ) : (
          <ul className="baker-list">
            {codes.map((codeItem) => (
              <li key={codeItem.id} className="baker-row">
                <div className="baker-info">
                  <strong>
                    {t.inviteCodes.codeLabel} {codeItem.code}
                  </strong>{' '}
                  <span
                    className={`baker-status ${codeItem.revokedAt ? 'is-unverified' : 'is-verified'}`}
                  >
                    {codeItem.revokedAt ? t.inviteCodes.revokedLabel : t.inviteCodes.activeLabel}
                  </span>
                  {codeItem.note && <p className="baker-contact">{codeItem.note}</p>}
                  <p className="baker-contact">
                    {t.inviteCodes.createdPrefix} {new Date(codeItem.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {!codeItem.revokedAt && (
                  <div className="baker-action">
                    <button
                      type="button"
                      onClick={() => handleRevoke(codeItem)}
                      disabled={busyId === codeItem.id}
                    >
                      {busyId === codeItem.id ? t.inviteCodes.revoking : t.inviteCodes.revoke}
                    </button>
                    {errorId === codeItem.id && (
                      <p className="reserve-error">{t.inviteCodes.revokeError}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
