import { useEffect, useState } from 'react';
import type { Dictionary } from '../i18n/types';
import type { Language } from '../i18n/language';
import type { CakeRequest } from '../types';
import { commitRequest, releaseRequest, resendDetails } from '../lib/requestsApi';
import { holdRemaining } from '../lib/holdCountdown';

type Props = {
  t: Dictionary;
  language: Language;
  request: CakeRequest;
  token: string;
  onUpdated: (updated: CakeRequest) => void;
  onClose: () => void;
};

type View = 'choose' | 'thanks';
type Busy = 'idle' | 'working' | 'error';
type Resend = 'idle' | 'sending' | 'done' | 'error';

// The hold box: shown while a baker is holding a cake. Two choices: let it go,
// or commit to bake it (which e-mails them the recipient's details). The hour is
// counted from the server's deadline; when it runs out the box closes itself.
export default function HoldBox({ t, language, request, token, onUpdated, onClose }: Props) {
  const [view, setView] = useState<View>('choose');
  const [busy, setBusy] = useState<Busy>('idle');
  const [emailSent, setEmailSent] = useState(true);
  const [committed, setCommitted] = useState<CakeRequest | null>(null);
  const [resend, setResend] = useState<Resend>('idle');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (view !== 'choose') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view]);

  const { expired, minutes, seconds } = holdRemaining(request.reservedUntil, now);

  // When the hour runs out the cake is open again: tell the baker and close.
  useEffect(() => {
    if (view === 'choose' && expired) {
      window.alert(t.list.holdExpired);
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, view]);

  async function letGo() {
    setBusy('working');
    try {
      onUpdated(await releaseRequest(request.id, token));
      onClose();
    } catch {
      setBusy('error');
    }
  }

  async function bake() {
    setBusy('working');
    try {
      const result = await commitRequest(request.id, token, language);
      // Keep the card on screen until the thank-you box is closed: the moment the
      // list learns it is committed, Browse drops it (see RequestCard).
      setCommitted(result.request);
      setEmailSent(result.emailSent);
      setView('thanks');
      setBusy('idle');
    } catch {
      setBusy('error');
    }
  }

  async function sendAgain() {
    setResend('sending');
    try {
      await resendDetails(request.id, token, language);
      setResend('done');
    } catch {
      setResend('error');
    }
  }

  function finish() {
    if (committed) onUpdated(committed);
    onClose();
  }

  return (
    <div className="hold-overlay" role="dialog" aria-modal="true">
      <div className="hold-box">
        {view === 'choose' ? (
          <>
            <h2>{t.list.holdTitle}</h2>
            <p>{t.list.holdIntro}</p>
            <p className="countdown">
              {t.list.timeLeftPrefix} {minutes}m {seconds}s
            </p>
            {busy === 'error' && <p className="reserve-error">{t.list.holdTaken}</p>}
            <div className="hold-actions">
              <button type="button" onClick={letGo} disabled={busy === 'working'}>
                {t.list.notThisTime}
              </button>
              <button
                type="button"
                className="reserve-button"
                onClick={bake}
                disabled={busy === 'working'}
              >
                {busy === 'working' ? t.list.holdWorking : t.list.bakeIt}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>{t.list.thanksTitle}</h2>
            <p>{t.list.thanksBody.replace('{org}', request.organizationName || t.list.thanksOrgFallback)}</p>
            {!emailSent && resend !== 'done' && <p>{t.list.thanksEmailFailed}</p>}
            {!emailSent && resend !== 'done' && (
              <button type="button" onClick={sendAgain} disabled={resend === 'sending'}>
                {resend === 'sending' ? t.list.resendSending : t.list.resendDetails}
              </button>
            )}
            {resend === 'done' && <p>{t.list.resendDone}</p>}
            {resend === 'error' && <p className="reserve-error">{t.list.resendError}</p>}
            {(emailSent || resend === 'done') && <p>{t.list.thanksCheckEmail}</p>}
            <button type="button" className="reserve-button" onClick={finish}>
              {t.list.closeBox}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
