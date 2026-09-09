import { NavLink } from 'react-router-dom';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';

// The row of view links under the header. Bakers, admins and signed-out
// visitors get "Open requests" (the public shop window); a requester does not —
// their world is their own requests, not everyone else's. Each role also gets
// the one extra link that belongs to it. The active link is highlighted so you
// always know which view you're on.
export default function AppNav({ t }: { t: Dictionary }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

  return (
    <nav className="app-nav" aria-label={t.nav.browse}>
      {role !== 'requester' && (
        <NavLink to="/browse" className={linkClass}>
          {t.nav.browse}
        </NavLink>
      )}
      <NavLink to="/gallery" className={linkClass}>
        {t.nav.gallery}
      </NavLink>
      {(!role || role === 'baker') && (
        <NavLink to="/join" className={linkClass}>
          {t.nav.join}
        </NavLink>
      )}
      {role === 'requester' && (
        <NavLink to="/my" className={linkClass}>
          {t.nav.myRequests}
        </NavLink>
      )}
      {role === 'baker' && (
        <NavLink to="/reservations" className={linkClass}>
          {t.nav.myReservations}
        </NavLink>
      )}
      {role === 'baker' && (
        <NavLink to="/notifications" className={linkClass}>
          {t.nav.notifications}
        </NavLink>
      )}
      {role === 'admin' && (
        <NavLink to="/admin/dashboard" className={linkClass}>
          {t.nav.dashboard}
        </NavLink>
      )}
      {role === 'admin' && (
        <NavLink to="/admin" className={linkClass} end>
          {t.nav.admin}
        </NavLink>
      )}
      {role === 'admin' && (
        <NavLink to="/admin/bakers" className={linkClass}>
          {t.nav.bakers}
        </NavLink>
      )}
      {role === 'admin' && (
        <NavLink to="/admin/attention" className={linkClass}>
          {t.nav.attention}
        </NavLink>
      )}
      {role === 'admin' && (
        <NavLink to="/admin/invite-codes" className={linkClass}>
          {t.nav.inviteCodes}
        </NavLink>
      )}
    </nav>
  );
}
