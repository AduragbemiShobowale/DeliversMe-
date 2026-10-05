import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { ROLE_HOME } from '@/config/site';
import { FullPageSpinner } from '@/components/common/Spinner';
import { ErrorState } from '@/components/common/States';
import { Button } from '@/components/common/Button';

function AccountProblem() {
  const { refresh, signOut } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <ErrorState
        title="Your account profile could not be loaded"
        message="Your sign-in worked, but your DeliverSME profile is missing or unreachable. Retry, or sign out and back in."
        action={<div className="flex gap-2"><Button onClick={refresh}>Retry</Button><Button variant="outline" onClick={signOut}>Sign out</Button></div>}
      />
    </div>
  );
}

/** Requires a signed-in, onboarded, active user whose role is in `roles`. */
export function RequireRole({ roles }) {
  const { user, profile, loading, accountLoading } = useAuth();
  const location = useLocation();
  if (loading || accountLoading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) return <AccountProblem />;
  if (!profile.onboarded) return <Navigate to="/onboarding" replace />;
  if (!roles.includes(profile.role)) return <Navigate to={ROLE_HOME[profile.role] || '/'} replace />;
  return <Outlet />;
}

/** For login/register pages: signed-in users go to their dashboard. */
export function GuestOnly() {
  const { user, profile, loading, accountLoading } = useAuth();
  if (loading || accountLoading) return <FullPageSpinner />;
  if (user && profile) {
    return <Navigate to={profile.onboarded ? ROLE_HOME[profile.role] : '/onboarding'} replace />;
  }
  return <Outlet />;
}

export function RequireSession() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
