import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';
import { optionLabel } from '../lib/optionLabels';
import { getNewRelevant, markNotificationsSeen, type RelevantRequest } from '../lib/notificationsApi';

// The header 🔔 for bakers: a badge with the number of new open requests that
// match what they can make, and a panel listing them. Pull-based — it refreshes
// on load; opening the panel marks them seen and clears the badge.
export default function NotificationBell({ t }: { t: Dictionary }) {
  const { profile, session } = useAuth();
  const token = session?.access_token;
  const isBaker = profile?.role === 'baker';

  const [count, setCount] = useState(0);
  const [items, setItems] = useState<RelevantRequest[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Pull the latest relevant requests on load / whenever the signed-in baker changes.
  useEffect(() => {
    if (!isBaker || !token) return;
    let cancelled = false;
    getNewRelevant(token)
      .then((data) => {
        if (cancelled) return;
        setCount(data.count);
        setItems(data.items);
      })
      .catch(() => {}); // a bell that can't load simply shows nothing
    return () => {
      cancelled = true;
    };
  }, [isBaker, token]);

  // Close the panel when clicking outside it.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!isBaker) return null;

  function handleToggle() {
    const next = !open;
    setOpen(next);
    // Opening the panel counts as "seen": clear the badge and tell the server,
    // so next time only requests newer than now are counted.
    if (next && count > 0 && token) {
      setCount(0);
      markNotificationsSeen(token).catch(() => {});
    }
  }

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="notif-bell-button"
        aria-label={t.notifications.bellTitle}
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span aria-hidden>🔔</span>
        {count > 0 && <span className="notif-badge">{count}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label={t.notifications.bellHeading}>
          <h3>{t.notifications.bellHeading}</h3>
          {items.length === 0 ? (
            <p className="notif-empty">{t.notifications.bellEmpty}</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <NavLink to="/browse" onClick={() => setOpen(false)}>
                    <strong>{item.occasion}</strong>
                    <span className="notif-area">{optionLabel(t.options.area, item.area)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
          <NavLink to="/notifications" className="notif-settings-link" onClick={() => setOpen(false)}>
            {t.notifications.bellSettingsHint}
          </NavLink>
        </div>
      )}
    </div>
  );
}
