import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';
import { isStrongPassword } from '../lib/signupValidation';

type Props = { t: Dictionary };

// Where the "reset your password" email link lands. Supabase's client picks
// the recovery token up from the URL automatically (detectSessionInUrl) and
// turns it into a real, temporary session — so by the time this renders,
// `session` is already the person resetting their password, not whoever (if
// anyone) was signed in before they clicked the link.
export default function ResetPasswordPage({ t }: Props) {
  const { configured, loading, session, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!configured) return <p className="auth-note">{t.auth.notConfigured}</p>;
  if (loading) return <p className="list-status" aria-hidden />;

  // No recovery session: either the link was already used, expired, or this
  // page was opened directly. Send them back to request a fresh one.
  if (!session && !done) {
    return (
      <div className="auth-panel">
        <p className="auth-note">{t.auth.invalidResetLink}</p>
        <Link className="auth-link" to="/">
          {t.auth.backToSignIn}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-panel">
        <p className="auth-note">{t.auth.passwordUpdated}</p>
        <Link className="auth-link" to="/">
          {t.auth.continueToSignIn}
        </Link>
      </div>
    );
  }

  const passwordInvalid = password.length > 0 && !isStrongPassword(password);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isStrongPassword(password)) {
      setPasswordTouched(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.updatePasswordError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <h2>{t.auth.resetHeading}</h2>
      <label>
        {t.auth.newPasswordLabel}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setPasswordTouched(true)}
          required
        />
        <small className={passwordTouched && passwordInvalid ? 'field-error' : undefined}>
          {t.auth.passwordHint}
        </small>
      </label>
      {error && <p className="auth-error">{error}</p>}
      <div className="auth-actions">
        <button type="submit" disabled={busy}>
          {busy ? t.auth.working : t.auth.updatePasswordButton}
        </button>
      </div>
    </form>
  );
}
