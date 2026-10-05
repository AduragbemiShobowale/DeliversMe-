import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../shared/lib/supabase";
import type { UserRole } from "../types/database";

interface AuthState {
  session: Session | null;
  role: UserRole | null;
  businessId: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  businessId: null,
  loading: true,
});

/**
 * Cross-cutting session + role context. Per Stage 18, this is the one
 * piece of state that legitimately lives above individual routes/screens
 * — everything else is TanStack Query (server state) or local component
 * state (UI state).
 *
 * IMPORTANT: `role` here drives ROUTING and UI ONLY. It is not a security
 * boundary. A user could tamper with this in the browser and it would
 * change nothing about what data they can actually read or write —
 * that's RLS's job (Stage 16), enforced in Postgres, not here. Never
 * add a check here and treat it as "secured."
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!active) return;
      setSession(currentSession);
      if (currentSession) {
        await loadRole(currentSession.user.id);
      }
      setLoading(false);
    }

    async function loadRole(userId: string) {
      // profiles.role — RLS restricts this SELECT to the caller's own row
      // (Stage 16), so this query is safe to run unscoped from the client.
      const { data, error } = await supabase
        .from("profiles")
        .select("role, business_id")
        .eq("id", userId)
        .single();
      if (!active) return;
      if (error || !data) {
        // A profile row should always exist for a logged-in user (created
        // at signup/invite-acceptance per Stage 3). If it doesn't, that's
        // a data-integrity problem worth surfacing, not silently ignoring.
        console.error("Failed to load profile role:", error?.message);
        setRole(null);
        setBusinessId(null);
        return;
      }
      setRole(data.role);
      setBusinessId(data.business_id);

      // Auto-claim any pending business_customers relationships matching
      // this customer's phone (0024) -- safe to call every load, it's a
      // no-op once everything pending has already been claimed.
      if (data.role === "customer") {
        void (async () => {
          try {
            await supabase.rpc("claim_pending_relationships_by_phone");
          } catch (err) {
            console.error("Failed to auto-claim pending relationships:", err);
          }
        })();
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!active) return;
      setSession(newSession);
      if (newSession) {
        await loadRole(newSession.user.id);
      } else {
        setRole(null);
        setBusinessId(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, role, businessId, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
