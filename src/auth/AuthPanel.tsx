import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import { DIETARY_OPTIONS, KASHRUT_OPTIONS, toggleOption, setOtherFreeText } from '../lib/options';
import { isStrongPassword, isValidContact } from '../lib/signupValidation';
import CapabilityGroup from '../components/CapabilityGroup';
import PasswordField from '../components/PasswordField';
import TownField from '../components/TownField';
import { useAuth } from './AuthProvider';

const DEFAULT_TRAVEL_RADIUS_KM = 15;

type Props = { t: Dictionary; language: Language };
type Mode = 'signIn' | 'signUp' | 'reset';

export default function AuthPanel({ t, language }: Props) {
  const { configured, loading, profile, signIn, signUp, signOut, requestPasswordReset } =
    useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [notifyHomeTown, setNotifyHomeTown] = useState('');
  const [notifyTravelRadiusKm, setNotifyTravelRadiusKm] = useState(DEFAULT_TRAVEL_RADIUS_KM);
  const [notifyKashrut, setNotifyKashrut] = useState<string[]>([]);
  const [notifyDietary, setNotifyDietary] = useState<string[]>([]);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [contactTouched, setContactTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);

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

  if (resetSent) {
    return (
      <div className="auth-panel">
        <p className="auth-note">{t.auth.resetEmailSent}</p>
        <button
          type="button"
          className="auth-link"
          onClick={() => {
            setResetSent(false);
            setMode('signIn');
          }}
        >
          {t.auth.backToSignIn}
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
      if (mode === 'reset') {
        await requestPasswordReset(email);
        setResetSent(true);
      } else if (mode === 'signIn') {
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
      <h2>
        {mode === 'reset'
          ? t.auth.resetHeading
          : mode === 'signIn'
            ? t.auth.signInHeading
            : t.auth.signUpHeading}
      </h2>
      {mode === 'reset' && <p className="auth-note">{t.auth.resetIntro}</p>}
      <label>
        {t.auth.emailLabel}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {mode !== 'reset' && (
        <PasswordField
          label={t.auth.passwordLabel}
          value={password}
          onChange={setPassword}
          onBlur={() => setPasswordTouched(true)}
          showLabel={t.auth.showPassword}
          hideLabel={t.auth.hidePassword}
          required
        />
      )}
      {mode === 'signUp' && (
        <small className={passwordTouched && passwordInvalid ? 'field-error' : undefined}>
          {t.auth.passwordHint}
        </small>
      )}
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
              language={language}
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
              onToggle={(v) => setNotifyKashrut(toggleOption(notifyKashrut, v))}
            />
            <CapabilityGroup
              legend={t.notifications.dietaryLabel}
              options={DIETARY_OPTIONS}
              labels={t.options.dietary}
              selected={notifyDietary}
              onToggle={(v) => setNotifyDietary(toggleOption(notifyDietary, v))}
              onOtherTextChange={(text) => setNotifyDietary(setOtherFreeText(notifyDietary, text))}
              otherPlaceholder={t.options.otherPlaceholder}
            />
          </div>
        </>
      )}
      {error && <p className="auth-error">{error}</p>}
      <div className="auth-actions">
        <button type="submit" disabled={busy}>
          {busy
            ? t.auth.working
            : mode === 'reset'
              ? t.auth.resetSendButton
              : mode === 'signIn'
                ? t.auth.signInButton
                : t.auth.signUpButton}
        </button>
        {mode === 'reset' ? (
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setMode('signIn');
              setError(null);
            }}
          >
            {t.auth.backToSignIn}
          </button>
        ) : (
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
        )}
      </div>
      {mode === 'signIn' && (
        <button
          type="button"
          className="auth-link auth-forgot-link"
          onClick={() => {
            setMode('reset');
            setError(null);
          }}
        >
          {t.auth.forgotPassword}
        </button>
      )}
      {mode === 'signUp' && (
        <Link className="auth-link auth-join-link" to="/join">
          {t.auth.joinPrompt}
        </Link>
      )}
    </form>
  );
}
