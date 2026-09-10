import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Dictionary } from '../i18n/types';
import { DIETARY_OPTIONS, KASHRUT_OPTIONS } from '../lib/options';
import { isStrongPassword, isValidContact } from '../lib/signupValidation';
import CapabilityGroup from '../components/CapabilityGroup';
import TownField from '../components/TownField';
import { useAuth } from './AuthProvider';

const DEFAULT_TRAVEL_RADIUS_KM = 15;

type Props = { t: Dictionary };
type Mode = 'signIn' | 'signUp';

export default function AuthPanel({ t }: Props) {
  const { configured, loading, profile, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [notifyHomeTown, setNotifyHomeTown] = useState('');
  const [notifyTravelRadiusKm, setNotifyTravelRadiusKm] = useState(DEFAULT_TRAVEL_RADIUS_KM);
  const [notifyKashrut, setNotifyKashrut] = useState<string[]>([]);
  const [notifyDietary, setNotifyDietary] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [contactTouched, setContactTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  if (!configured) return <p className="auth-note">{t.auth.notConfigured}</p>;
  if (loading) return null;

  if (checkEmail) {
    return (
      <div className="auth-panel">
        <p className="auth-note">{t.auth.checkEmail}</p>
        <button
          type="button"
          className="auth-link"
          onClick={() => {
            setCheckEmail(false);
            setMode('signIn');
          }}
        >
          {t.auth.haveAccount}
        </button>
      </div>
    );
  }

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
    // Block sign-up while the password or contact is invalid. Reveal both fields'
    // messages (as if they'd been left) so someone who jumps straight to the
    // button still sees exactly what needs fixing, rather than a bounced request.
    if (mode === 'signUp' && (!isStrongPassword(password) || !isValidContact(contact))) {
      setPasswordTouched(true);
      setContactTouched(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        const { emailConfirmationRequired } = await signUp(
          email,
          password,
          name,
          contact,
          notifyHomeTown,
          notifyTravelRadiusKm,
          notifyKashrut,
          notifyDietary,
        );
        if (emailConfirmationRequired) setCheckEmail(true);
      }
    } catch (err) {
      // Show the real reason (e.g. "Email not confirmed") — it's more useful
      // than a generic line while learning; fall back if there's no message.
      setError(err instanceof Error ? err.message : t.auth.genericError);
    } finally {
      setBusy(false);
    }
  }

  // Whether each field currently fails its rule. The red message is only shown
  // once the field has been left (its `touched` flag) — see the JSX below — so we
  // never nag mid-typing; an empty field is never counted as failing.
  const passwordInvalid = mode === 'signUp' && password.length > 0 && !isStrongPassword(password);
  const contactInvalid = mode === 'signUp' && contact.trim() !== '' && !isValidContact(contact);

  return (
    <form className="auth-panel" onSubmit={handleSubmit}>
      <h2>{mode === 'signIn' ? t.auth.signInHeading : t.auth.signUpHeading}</h2>
      <label>
        {t.auth.emailLabel}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        {t.auth.passwordLabel}
        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPasswordTouched(true)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
        {mode === 'signUp' && (
          <small className={passwordTouched && passwordInvalid ? 'field-error' : undefined}>
            {t.auth.passwordHint}
          </small>
        )}
      </label>
      {mode === 'signUp' && (
        <>
          <label>
            {t.auth.nameLabel}
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            {t.auth.contactLabel}
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onBlur={() => setContactTouched(true)}
            />
            <small>{t.auth.contactHint}</small>
            {contactTouched && contactInvalid && (
              <small className="field-error">{t.auth.contactInvalid}</small>
            )}
          </label>
          <div className="baker-caps">
            <p className="baker-caps-heading">{t.auth.bakerCapabilitiesHeading}</p>
            <small className="baker-caps-note">{t.auth.bakerCapabilitiesNote}</small>
            <TownField
              label={t.notifications.homeTownLabel}
              value={notifyHomeTown}
              onChange={setNotifyHomeTown}
              hint={t.notifications.homeTownHint}
            />
            <label>
              {t.notifications.travelRadiusLabel}
              <input
                type="number"
                min={1}
                max={300}
                value={notifyTravelRadiusKm}
                onChange={(e) => setNotifyTravelRadiusKm(Number(e.target.value))}
              />
            </label>
            <CapabilityGroup
              legend={t.notifications.kashrutLabel}
              options={KASHRUT_OPTIONS}
              labels={t.options.kashrut}
              selected={notifyKashrut}
              onToggle={(v) => toggle(notifyKashrut, setNotifyKashrut, v)}
            />
            <CapabilityGroup
              legend={t.notifications.dietaryLabel}
              options={DIETARY_OPTIONS}
              labels={t.options.dietary}
              selected={notifyDietary}
              onToggle={(v) => toggle(notifyDietary, setNotifyDietary, v)}
            />
          </div>
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
            setPasswordTouched(false);
            setContactTouched(false);
          }}
        >
          {mode === 'signIn' ? t.auth.needAccount : t.auth.haveAccount}
        </button>
      </div>
      {mode === 'signUp' && (
        <Link className="auth-link auth-join-link" to="/join">
          {t.auth.joinPrompt}
        </Link>
      )}
    </form>
  );
}

// A small eye icon for the reveal-password toggle. When `off` is true (the
// password is currently visible) it shows the "eye with a slash" variant. It's
// decorative — the button that wraps it carries the accessible label.
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {off ? (
        <>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}
