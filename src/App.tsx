import { useState, useEffect } from 'react';
import RequestForm from './components/RequestForm';
import RequestList from './components/RequestList';
import LanguageToggle from './components/LanguageToggle';
import { dictionaries, loadLanguage, saveLanguage, type Language } from './i18n/language';
import { createRequest } from './lib/requests';
import type { CakeRequest, RequestDraft } from './types';

export default function App() {
  // Start from whatever language was saved last (English the first time).
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [requests, setRequests] = useState<CakeRequest[]>([]);

  const t = dictionaries[language];

  // Keep the page's reading direction and lang attribute in step with the language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
  }, [language]);

  function handleLanguageChange(next: Language) {
    setLanguage(next);
    saveLanguage(next);
  }

  function handleAdd(draft: RequestDraft) {
    const request = createRequest(draft);
    setRequests((prev) => [request, ...prev]); // newest first
  }

  return (
    <main className="app">
      <header className="app-header">
        <LanguageToggle t={t} language={language} onChange={handleLanguageChange} />
        <h1>{t.appTitle}</h1>
        <p>{t.tagline}</p>
      </header>
      <RequestForm t={t} onAdd={handleAdd} />
      <RequestList t={t} requests={requests} />
    </main>
  );
}
