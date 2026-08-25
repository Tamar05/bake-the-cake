import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Profile } from '../lib/authApi';

type Role = Profile['role'];

// Wraps a route so only the listed roles may see it. While we're still working
// out who the viewer is, we wait (a brief blank) rather than bounce a signed-in
// person away by mistake. Anyone not allowed is redirected to the public browse
// view. The server enforces the same rules, so this is convenience, not the gate.
export default function RequireRole({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { loading, profileLoading, profile } = useAuth();
  if (loading || profileLoading) return <p className="list-status" aria-hidden />;
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/browse" replace />;
  return <>{children}</>;
}
