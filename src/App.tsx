import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LanguageToggle from './components/LanguageToggle';
import AppNav from './components/AppNav';
import AuthPanel from './auth/AuthPanel';
import { useAuth } from './auth/AuthProvider';
import RequireRole from './pages/RequireRole';
import BrowsePage from './pages/BrowsePage';
import MyRequestsPage from './pages/MyRequestsPage';
import MyReservationsPage from './pages/MyReservationsPage';
import AdminPage from './pages/AdminPage';
import AdminBakersPage from './pages/AdminBakersPage';
import { dictionaries, loadLanguage, saveLanguage, type Language } from './i18n/language';
import { loadRequests, saveRequest } from './lib/requestsApi';
import type { CakeRequest, RequestDraft } from './types';

type Status = 'loading' | 'ready' | 'error';

export default function App() {
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [requests, setRequests] = useState<CakeRequest[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  const t = dictionaries[language];
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

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

  // A card was deleted; drop it from the shared list.
  function handleDeleted(id: string) {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  const listProps = {
    t,
    language,
    requests,
    onUpdated: handleRequestUpdated,
    onDeleted: handleDeleted,
  };

  return (
    <main className="app">
      <header className="app-header">
        <LanguageToggle t={t} language={language} onChange={handleLanguageChange} />
        <h1>{t.appTitle}</h1>
        <p>{t.tagline}</p>
        <AuthPanel t={t} />
      </header>

      <AppNav t={t} />

      {status === 'loading' && <p className="list-status">{t.list.loading}</p>}
      {status === 'error' && <p className="list-status list-error">{t.list.loadError}</p>}
      {status === 'ready' && (
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/browse" element={<BrowsePage {...listProps} />} />
          <Route
            path="/my"
            element={
              <RequireRole roles={['requester']}>
                <MyRequestsPage {...listProps} onAdd={handleAdd} />
              </RequireRole>
            }
          />
          <Route
            path="/reservations"
            element={
              <RequireRole roles={['baker']}>
                <MyReservationsPage {...listProps} />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole roles={['admin']}>
                <AdminPage {...listProps} />
              </RequireRole>
            }
          />
          <Route
            path="/admin/bakers"
            element={
              <RequireRole roles={['admin']}>
                <AdminBakersPage t={t} />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/browse" replace />} />
        </Routes>
      )}
    </main>
  );
}

// The landing route ("/") sends each person to their own home once we know who
// they are: requesters to their requests, admins to the admin view, and bakers
// (plus signed-out visitors) to the public browse view.
function HomeRedirect() {
  const { loading, profileLoading, profile } = useAuth();
  if (loading || profileLoading) return <p className="list-status" aria-hidden />;
  if (profile?.role === 'requester') return <Navigate to="/my" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/browse" replace />;
}
