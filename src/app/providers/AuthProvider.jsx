import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchAccount } from '@/services/profiles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState({ profile: null, business: null, rider: null });
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovery, setRecovery] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);

  const loadAccount = useCallback(async (user) => {
    if (!user) {
      setAccount({ profile: null, business: null, rider: null });
      return;
    }
    setAccountLoading(true);
    try {
      const acc = await fetchAccount(user.id);
      if (acc.profile && !acc.profile.is_active) {
        toast.error('This account has been suspended. Contact support.');
        await supabase.auth.signOut();
        setAccount({ profile: null, business: null, rider: null });
        return;
      }
      setAccount(acc);
    } catch {
      setAccount({ profile: null, business: null, rider: null });
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadAccount(data.session?.user);
      if (mounted) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(next);
      // Defer Supabase calls out of the auth callback (recommended by supabase-js to avoid deadlocks).
      setTimeout(() => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
          loadAccount(next?.user);
        }
      }, 0);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadAccount]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile: account.profile,
    business: account.business,
    rider: account.rider,
    role: account.profile?.role ?? null,
    loading,
    accountLoading,
    recovery,
    clearRecovery: () => setRecovery(false),
    refresh: () => loadAccount(session?.user),
    setRider: (rider) => setAccount((a) => ({ ...a, rider })),
    signOut: async () => {
      await supabase.auth.signOut();
      setAccount({ profile: null, business: null, rider: null });
    },
  }), [session, account, loading, accountLoading, recovery, loadAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { AuthContext };
