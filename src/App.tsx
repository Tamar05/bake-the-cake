import { useState, useEffect, type ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import LanguageToggle from "./components/LanguageToggle";
import NotificationBell from "./components/NotificationBell";
import AppNav from "./components/AppNav";
import AuthPanel from "./auth/AuthPanel";
import { useAuth } from "./auth/AuthProvider";
import RequireRole from "./pages/RequireRole";
import BrowsePage from "./pages/BrowsePage";
import MyRequestsPage from "./pages/MyRequestsPage";
import NewRequestPage from "./pages/NewRequestPage";
import MyReservationsPage from "./pages/MyReservationsPage";
import BakerNotificationsPage from "./pages/BakerNotificationsPage";
import BakerSetupPage from "./pages/BakerSetupPage";
import { getNotificationSettings } from "./lib/notificationsApi";
import AdminPage from "./pages/AdminPage";
import AdminBakersPage from "./pages/AdminBakersPage";
import AdminAttentionPage from "./pages/AdminAttentionPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminInviteCodesPage from "./pages/AdminInviteCodesPage";
import GalleryPage from "./pages/GalleryPage";
import JoinPage from "./pages/JoinPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import {
  dictionaries,
  loadLanguage,
  saveLanguage,
  type Language,
} from "./i18n/language";
import { loadRequests, saveRequest } from "./lib/requestsApi";
import type { Dictionary } from "./i18n/types";
import type { CakeRequest, RequestDraft } from "./types";

type Status = "loading" | "ready" | "error";

export default function App() {
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const [requests, setRequests] = useState<CakeRequest[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const t = dictionaries[language];
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  // Keep the page's reading direction and lang in step with the language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
  }, [language]);

  // Load requests once we know whether someone is signed in, and reload on sign
  // in/out so reserver details appear or disappear for the right viewer.
  useEffect(() => {
    if (authLoading) return;
    setStatus("loading");
    loadRequests(token)
      .then((list) => {
        setRequests(list);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
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
      setStatus("error");
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
        <div className="header-controls">
          <LanguageToggle
            t={t}
            language={language}
            onChange={handleLanguageChange}
          />
          <NotificationBell t={t} />
        </div>
        <h1>{t.appTitle}</h1>
        <p>{t.tagline}</p>
        <AuthPanel t={t} language={language} />
      </header>

      <AppNav t={t} />

      {status === "loading" && <p className="list-status">{t.list.loading}</p>}
      {status === "error" && (
        <p className="list-status list-error">{t.list.loadError}</p>
      )}
      {status === "ready" && (
        <BakerSetupGate t={t} language={language}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route
              path="/browse"
              element={
                <HideFromRequester>
                  <BrowsePage {...listProps} />
                </HideFromRequester>
              }
            />
            <Route path="/gallery" element={<GalleryPage t={t} />} />
            <Route path="/join" element={<JoinPage t={t} />} />
            <Route
              path="/reset-password"
              element={<ResetPasswordPage t={t} />}
            />
            <Route
              path="/my"
              element={
                <RequireRole roles={["requester"]}>
                  <MyRequestsPage {...listProps} />
                </RequireRole>
              }
            />
            <Route
              path="/my/new"
              element={
                <RequireRole roles={["requester"]}>
                  <NewRequestPage t={t} language={language} onAdd={handleAdd} />
                </RequireRole>
              }
            />
            <Route
              path="/reservations"
              element={
                <RequireRole roles={["baker"]}>
                  <MyReservationsPage {...listProps} />
                </RequireRole>
              }
            />
            <Route
              path="/notifications"
              element={
                <RequireRole roles={["baker"]}>
                  <BakerNotificationsPage t={t} language={language} />
                </RequireRole>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminPage {...listProps} />
                </RequireRole>
              }
            />
            <Route
              path="/admin/bakers"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminBakersPage t={t} />
                </RequireRole>
              }
            />
            <Route
              path="/admin/attention"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminAttentionPage t={t} />
                </RequireRole>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminDashboardPage t={t} />
                </RequireRole>
              }
            />
            <Route
              path="/admin/invite-codes"
              element={
                <RequireRole roles={["admin"]}>
                  <AdminInviteCodesPage t={t} />
                </RequireRole>
              }
            />
            <Route path="*" element={<Navigate to="/browse" replace />} />
          </Routes>
        </BakerSetupGate>
      )}
    </main>
  );
}

// The landing route ("/") sends each person to their own home once we know who
// they are: requesters to their requests, admins to the admin view, and bakers
// (plus signed-out visitors) to the public browse view.
function HomeRedirect() {
  const { loading, profileLoading, profile } = useAuth();
  if (loading || profileLoading)
    return <p className="list-status" aria-hidden />;
  if (profile?.role === "requester") return <Navigate to="/my" replace />;
  if (profile?.role === "admin")
    return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/browse" replace />;
}

// Guards the public browse view against requesters: bakers, admins, and signed-
// out visitors may see other people's open requests, but a requester should not
// — a direct visit sends them to their own requests instead. The nav hides the
// link for them too; this is the matching route-level gate.
function HideFromRequester({ children }: { children: ReactNode }) {
  const { loading, profileLoading, profile } = useAuth();
  if (loading || profileLoading)
    return <p className="list-status" aria-hidden />;
  if (profile?.role === "requester") return <Navigate to="/my" replace />;
  return <>{children}</>;
}

// A new baker's "finish setting up" step (area, kashrut, dietary), shown right
// after they confirm their email and sign in. It stands in for the page they
// were heading to until they save or skip. It never shows for: anyone who's
// already done it, bakers who set their notifications up before this step
// existed (checked once, then marked done), or /join, where a baker is mid-way
// to becoming an organization.
function BakerSetupGate({
  t,
  language,
  children,
}: {
  t: Dictionary;
  language: Language;
  children: ReactNode;
}) {
  const { session, profile, profileLoading, markSetupDone } = useAuth();
  const { pathname } = useLocation();
  const token = session?.access_token;
  const pending =
    profile?.role === "baker" &&
    session?.user.user_metadata?.setup_done !== true;
  // 'checking' while we look at their saved settings; 'new' = show the step.
  const [state, setState] = useState<"checking" | "new" | "existing">(
    "checking",
  );

  useEffect(() => {
    if (!pending || !token) return;
    let cancelled = false;
    getNotificationSettings(token)
      .then((s) => {
        if (cancelled) return;
        const configured =
          s.notifyNewRequests ||
          s.homeTown !== "" ||
          s.dietary.length > 0 ||
          s.kashrut.length > 0;
        if (configured) {
          setState("existing");
          markSetupDone().catch(() => {});
        } else {
          setState("new");
        }
      })
      // If we can't tell, don't trap them behind a setup screen.
      .catch(() => !cancelled && setState("existing"));
    return () => {
      cancelled = true;
    };
    // markSetupDone is stable enough; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, token]);

  if (profileLoading || !pending || pathname.startsWith("/join"))
    return <>{children}</>;
  if (state === "checking") return <p className="list-status" aria-hidden />;
  if (state === "new") return <BakerSetupPage t={t} language={language} />;
  return <>{children}</>;
}
