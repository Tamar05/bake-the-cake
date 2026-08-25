import { useState, type FormEvent } from 'react';
import type { Dictionary } from '../i18n/types';
import { useAuth, type SignUpRole } from './AuthProvider';

type Props = { t: Dictionary };
type Mode = 'signIn' | 'signUp';

export default function AuthPanel({ t }: Props) {
  const { configured, loading, profile, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<SignUpRole>('requester');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return <p className="auth-note">{t.auth.notConfigured}</p>;
  if (loading) return null;

  if (profile) {
    return (
      <div className="auth-panel signed-in">
        <span>
          {t.auth.signedInAs} <strong>{profile.displayName}</strong> · {profile.role}
        </span>
        <button type="button" onClick={() => signOut()}>
          {t.auth.signOut}
        </button>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(email, password, name, role, contact);
    } catch (err) {
      // Show the real reason (e.g. "Email not confirmed") — it's more useful
      // than a generic line while learning; fall back if there's no message.
      setError(err instanceof Error ? err.message : t.auth.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <h2>{mode === 'signIn' ? t.auth.signInHeading : t.auth.signUpHeading}</h2>
      <label>
        {t.auth.emailLabel}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        {t.auth.passwordLabel}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {mode === 'signUp' && (
        <>
          <label>
            {t.auth.nameLabel}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t.auth.roleLabel}
            <select value={role} onChange={(e) => setRole(e.target.value as SignUpRole)}>
              <option value="requester">{t.auth.roleRequester}</option>
              <option value="baker">{t.auth.roleBaker}</option>
            </select>
          </label>
          <label>
            {t.auth.contactLabel}
            <input value={contact} onChange={(e) => setContact(e.target.value)} />
            <small>{t.auth.contactHint}</small>
          </label>
        </>
      )}
      {error && <p className="auth-error">{error}</p>}
      <div className="auth-actions">
        <button type="submit" disabled={busy}>
          {busy ? t.auth.working : mode === 'signIn' ? t.auth.signInButton : t.auth.signUpButton}
        </button>
        <button
          type="button"
          className="auth-link"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
          }}
        >
          {mode === 'signIn' ? t.auth.needAccount : t.auth.haveAccount}
        </button>
      </div>
    </form>
  );
}
