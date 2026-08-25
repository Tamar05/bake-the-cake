import { useState, useEffect } from 'react';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import LanguageToggle from './components/LanguageToggle';
import AuthPanel from './auth/AuthPanel';
import { useAuth } from './auth/AuthProvider';
import { dictionaries, loadLanguage, saveLanguage, type Language } from './i18n/language';
import { loadRequests, saveRequest } from './lib/requestsApi';
import type { CakeRequest, RequestDraft } from './types';

type Status = 'loading' | 'ready' | 'error';

export default function App() {
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [requests, setRequests] = useState<CakeRequest[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const t = dictionaries[language];
  const { profile, session, loading: authLoading } = useAuth();
  const token = session?.access_token;
  // Only a signed-in requester (or admin) may post a cake request.
  const canPost = profile?.role === 'requester' || profile?.role === 'admin';

  // Keep the page's reading direction and lang in step with the language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  }, [language]);

  // Load requests once we know whether someone is signed in, and reload on sign
  // in/out so reserver details appear or disappear for the right viewer.
  useEffect(() => {
    if (authLoading) return;
    setStatus('loading');
    loadRequests(token)
      .then((list) => {
        setRequests(list);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [authLoading, token]);

  function handleLanguageChange(next: Language) {
    setLanguage(next);
    saveLanguage(next);
  }

  async function handleAdd(draft: RequestDraft) {
    if (!token) return; // the form is only shown to signed-in requesters
    try {
      const saved = await saveRequest(draft, token);
      setRequests((prev) => [saved, ...prev]); // newest first
    } catch {
      setStatus('error');
    }
  }

  // A card reserved or released itself; swap in the updated request by id.
  function handleRequestUpdated(updated: CakeRequest) {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  return (
    <main className="app">
      <header className="app-header">
        <LanguageToggle t={t} language={language} onChange={handleLanguageChange} />
        <h1>{t.appTitle}</h1>
        <p>{t.tagline}</p>
        <AuthPanel t={t} />
      </header>
      {canPost ? (
        <RequestForm t={t} onAdd={handleAdd} />
      ) : (
        <p className="post-note">{t.form.signInToPost}</p>
      )}
      {status === 'loading' && <p className="list-status">{t.list.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.list.loadError}</p>}
      {status === 'ready' && (
        <RequestList
          t={t}
          language={language}
          requests={requests}
          onUpdated={handleRequestUpdated}
        />
      )}
    </main>
  );
}
