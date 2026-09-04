import { useEffect, useState, type ReactNode } from 'react';
import { getInstallEnv } from '../lib/installState';
import { dictionaries, loadLanguage, saveLanguage, type Language } from '../i18n/language';

// The browser's install-prompt event (Chrome/Edge on Android + desktop). Captured
// so we can offer a one-tap Install button instead of hidden menu steps.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// Where a visitor's "continue in browser" choice is remembered, so they aren't
// re-nudged on every visit.
const SKIP_KEY = 'btc-skip-install';

function readSkip(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

// Nudges phone visitors to install the app: in a phone browser this shows a
// "get the app" screen offering install OR "continue in browser" (their choice
// is remembered). The installed app (running standalone) and any desktop browser
// pass straight through. In-app browsers (WhatsApp etc.) and iOS-outside-Safari
// get tailored guidance rather than a dead end. Installing matters mainly for
// bakers: push notifications need the installed app (iOS allows push only for
// home-screen web apps), so browser users won't get pinged about new requests.
export default function InstallGate({ children }: { children: ReactNode }) {
  const [env] = useState(() => getInstallEnv(window));
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [skipped, setSkipped] = useState(readSkip);
  const t = dictionaries[language].install;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // suppress Chrome's mini-infobar; we drive install from our button
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Installed app, any desktop browser, or a visitor who chose the browser → run
  // the real app.
  if (env.standalone || !env.mobile || skipped) return <>{children}</>;

  const switchLanguage = () => {
    const next: Language = language === 'he' ? 'en' : 'he';
    setLanguage(next);
    saveLanguage(next);
  };

  const runInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    setPrompt(null);
  };

  const continueInBrowser = () => {
    try {
      localStorage.setItem(SKIP_KEY, '1');
    } catch {
      /* private mode — the choice just won't persist across visits */
    }
    setSkipped(true);
  };

  const steps =
    env.platform === 'ios'
      ? [t.iosStep1, t.iosStep2, t.iosStep3, t.iosStep4]
      : [t.androidStep1, t.androidStep2];

  return (
    <div className="install-gate">
      <button type="button" className="install-lang" onClick={switchLanguage}>
        {language === 'he' ? 'English' : 'עברית'}
      </button>
      <div className="install-card">
        <img src="/icon-192.png" alt="" className="install-icon" width={88} height={88} />
        <h1>{t.title}</h1>
        <p className="install-lead">{t.lead}</p>

        {env.inAppBrowser && <p className="install-notice">{t.inAppNotice}</p>}
        {env.iosNonSafari && !env.inAppBrowser && (
          <p className="install-notice">{t.safariNotice}</p>
        )}

        {env.platform === 'android' && prompt ? (
          <button type="button" className="install-btn" onClick={runInstall}>
            {t.installButton}
          </button>
        ) : (
          <div className="install-steps">
            <h2>{t.stepsHeading}</h2>
            <ol>
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="install-continue-wrap">
          <button type="button" className="install-continue" onClick={continueInBrowser}>
            {t.continueInBrowser}
          </button>
          <p className="install-continue-note">{t.continueNote}</p>
        </div>

        <p className="install-foot">{t.alreadyInstalled}</p>
      </div>
    </div>
  );
}
