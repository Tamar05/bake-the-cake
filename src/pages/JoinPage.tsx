import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import type { Dictionary } from '../i18n/types';
import { isStrongPassword, isValidContact } from '../lib/signupValidation';
import { joinAsOrganization } from '../lib/authApi';
import { supabase } from '../lib/supabaseClient';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../auth/AuthProvider';

type Props = { t: Dictionary };

const ORG_NAME_MAX = 80;

// Lets someone become a requester (organization) by redeeming an invite code.
// Two paths, both landing on the same code/org-name step:
//  - signed out: sign up like any baker first (this page collects those
//    fields too), then immediately redeem the code with the new session.
//  - already signed in as a baker: skip straight to the code/org-name step.
// Someone already a requester or admin has nothing to do here.
export default function JoinPage({ t }: Props) {
  const { configured, loading, profileLoading, profile, session, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [orgName, setOrgName] = useState('');
  const [code, setCode] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [contactTouched, setContactTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  if (!configured) return <p className="auth-note">{t.auth.notConfigured}</p>;
  if (loading || profileLoading) return <p className="list-status" aria-hidden />;

  // Already something other than a plain baker: nothing to join, send them home.
  if (profile && profile.role !== 'baker') return <Navigate to="/" replace />;

  if (success) return <p className="list-status">{t.join.success}</p>;

  // Signed up, but Supabase requires confirming the email before issuing a
  // session — there's no token yet to redeem the code with. They'll come back
  // to this page once signed in (the alreadySignedIn branch below picks up
  // from there); their org name and code aren't saved across that gap.
  if (checkEmail) return <p className="auth-note">{t.auth.checkEmail}</p>;

  const alreadySignedIn = profile != null && session != null;
  const passwordInvalid = !alreadySignedIn && password.length > 0 && !isStrongPassword(password);
  const contactInvalid = !alreadySignedIn && contact.trim() !== '' && !isValidContact(contact);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleanOrgName = orgName.trim().slice(0, ORG_NAME_MAX);
    const cleanCode = code.trim();
    if (cleanOrgName === '' || cleanCode === '') {
      setError(t.join.missingFields);
      return;
    }
    if (!alreadySignedIn && (!isStrongPassword(password) || !isValidContact(contact))) {
      setPasswordTouched(true);
      setContactTouched(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let token = session?.access_token;
      if (!alreadySignedIn) {
        const { emailConfirmationRequired } = await signUp(email, password, name, contact);
        if (emailConfirmationRequired) {
          setCheckEmail(true);
          return;
        }
        // AuthProvider's signUp doesn't return the new session (it lands in
        // context on the next render), so read it directly to redeem the code
        // in this same action instead of waiting a render cycle.
        token = (await supabase?.auth.getSession())?.data.session?.access_token;
      }
      if (!token) throw new Error(t.join.invalidCode);
      await joinAsOrganization(cleanCode, cleanOrgName, token);
      setSuccess(true);
    } catch {
      setError(t.join.invalidCode);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-panel join-panel" onSubmit={handleSubmit}>
      <h2>{t.join.heading}</h2>
      <p className="join-intro">{alreadySignedIn ? t.join.signedInIntro : t.join.intro}</p>
      {!alreadySignedIn && (
        <>
          <label>
            {t.auth.emailLabel}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <PasswordField
            label={t.auth.passwordLabel}
            value={password}
            onChange={setPassword}
            onBlur={() => setPasswordTouched(true)}
            showLabel={t.auth.showPassword}
            hideLabel={t.auth.hidePassword}
            required
          />
          <small className={passwordTouched && passwordInvalid ? 'field-error' : undefined}>
            {t.auth.passwordHint}
          </small>
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
        </>
      )}
      <label>
        {t.join.orgNameLabel}
        <input
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          maxLength={ORG_NAME_MAX}
          required
        />
      </label>
      <label>
        {t.join.codeLabel}
        <input value={code} onChange={(e) => setCode(e.target.value)} required />
        <small>{t.join.codeHint}</small>
      </label>
      {error && <p className="auth-error">{error}</p>}
      <div className="auth-actions">
        <button type="submit" disabled={busy}>
          {busy ? t.join.working : t.join.submit}
        </button>
      </div>
    </form>
  );
}
