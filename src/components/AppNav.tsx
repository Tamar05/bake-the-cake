import { NavLink } from 'react-router-dom';
import type { Dictionary } from '../i18n/types';
import { useAuth } from '../auth/AuthProvider';

// The row of view links under the header. Everyone sees "Open requests"; each
// role also gets the one extra link that belongs to it. The active link is
// highlighted so you always know which view you're on.
export default function AppNav({ t }: { t: Dictionary }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined);

  return (
    <nav className="app-nav" aria-label={t.nav.browse}>
      <NavLink to="/browse" className={linkClass}>
        {t.nav.browse}
      </NavLink>
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
    </nav>
  );
}
