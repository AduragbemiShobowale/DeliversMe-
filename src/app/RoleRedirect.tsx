import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * Lands at "/" and sends the user to their role's shell (Stage 9, Flow 1).
 *
 * Real bug fixed here: `loading` only covers the very first getSession()
 * call on page load. Right after a fresh sign-in, `session` becomes
 * non-null via onAuthStateChange before the async `role` lookup finishes
 * -- without the extra check below, that brief window would hit the
 * `default` case and bounce straight back to /login, which is exactly
 * what was happening when login "succeeded" per the network tab but the
 * page never navigated anywhere.
 */
export function RoleRedirect() {
  const { session, role, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!role) return null; // session exists, role still loading -- wait, don't bounce to /login

  switch (role) {
    case "owner":
      return <Navigate to="/owner/dashboard" replace />;
    case "rider":
      return <Navigate to="/rider/jobs" replace />;
    case "customer":
      return <Navigate to="/customer/deliveries" replace />;
    case "admin":
      return <Navigate to="/admin/businesses" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}
