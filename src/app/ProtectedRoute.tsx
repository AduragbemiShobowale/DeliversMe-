import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import type { UserRole } from "../types/database";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

/**
 * Route-level guard, scoped by role.
 *
 * ============================================================
 * SECURITY NOTE (Stage 16 / Stage 20 build authorization):
 * This component provides NAVIGATION CONVENIENCE ONLY. It decides
 * whether to render a screen — it has no bearing on whether the
 * underlying data request would succeed or fail.
 *
 * A rider who edits localStorage or calls the Supabase client
 * directly from devtools bypasses this component trivially and
 * MUST STILL be blocked from every unauthorized read/write by RLS
 * policies enforced in Postgres (Stage 16) and by the RPC functions
 * that gate every state-changing operation (Stage 16/17).
 *
 * Do not add authorization logic here and consider the data secured.
 * If a security review ever finds this component doing more than
 * redirecting based on `role`, that's a sign RLS was skipped
 * somewhere and needs to be fixed at the database layer, not here.
 * ============================================================
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    // Session exists but the role lookup hasn't resolved yet (same race
    // as RoleRedirect) -- wait rather than bounce to "/", which would
    // otherwise cause a visible redirect flicker on every fresh sign-in.
    return (
      <div className="flex h-screen items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Loading…
      </div>
    );
  }

  if (!allowedRoles.includes(role)) {
    // Authenticated but wrong role for this route — send to their own
    // shell rather than a generic error, since we know who they are.
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
