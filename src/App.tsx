import { useState, useEffect } from 'react';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import LanguageToggle from './components/LanguageToggle';
import { dictionaries, loadLanguage, saveLanguage, type Language } from './i18n/language';
import { loadRequests, saveRequest } from './lib/requestsApi';
import type { CakeRequest, RequestDraft } from './types';

type Status = 'loading' | 'ready' | 'error';

export default function App() {
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [requests, setRequests] = useState<CakeRequest[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const t = dictionaries[language];

  // Keep the page's reading direction and lang in step with the language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  }, [language]);

  // Load the saved requests from the server once, on startup.
  useEffect(() => {
    loadRequests()
      .then((list) => {
        setRequests(list);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  function handleLanguageChange(next: Language) {
    setLanguage(next);
    saveLanguage(next);
  }

  async function handleAdd(draft: RequestDraft) {
    try {
      const saved = await saveRequest(draft);
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
      </header>
      <RequestForm t={t} onAdd={handleAdd} />
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
