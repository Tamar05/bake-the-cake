import { useEffect, useState, type ReactNode } from 'react';
import { getInstallEnv } from '../lib/installState';
import { dictionaries, loadLanguage, saveLanguage, type Language } from '../i18n/language';

// The browser's install-prompt event (Chrome/Edge on Android + desktop). Captured
// so we can offer a one-tap Install button instead of hidden menu steps.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// Requires phone visitors to install the app before using it: in a phone browser
// this shows an "install to continue" screen instead of the app. The installed
// app (running standalone) and any desktop browser pass straight through — the
// community shares the link and opens it on phones, and some desktop browsers
// can't install at all, so we don't trap them. In-app browsers (WhatsApp etc.)
// and iOS-outside-Safari get tailored guidance rather than a dead end.
export default function InstallGate({ children }: { children: ReactNode }) {
  const [env] = useState(() => getInstallEnv(window));
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
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

  // Installed app, or any desktop browser → run the real app.
  if (env.standalone || !env.mobile) return <>{children}</>;

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

  const steps =
    env.platform === 'ios'
      ? [t.iosStep1, t.iosStep2, t.iosStep3]
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

        <p className="install-foot">{t.alreadyInstalled}</p>
      </div>
    </div>
  );
}
