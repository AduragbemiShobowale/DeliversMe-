import { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { siteUrl } from '@/config/site';
import { errorMessage } from '@/lib/errors';

const Google = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" /></svg>
);
const Microsoft = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M13 1h10v10H13z" /><path fill="#00A4EF" d="M1 13h10v10H1z" /><path fill="#FFB900" d="M13 13h10v10H13z" /></svg>
);

/**
 * Google / Microsoft sign-in through Supabase OAuth. Each provider must be enabled in the Supabase
 * dashboard (Authentication → Providers); otherwise Supabase returns an error that we show as a toast.
 * New OAuth users land on /onboarding to choose an account type.
 */
export function OAuthButtons() {
  const [busy, setBusy] = useState(null);
  const go = async (provider) => {
    setBusy(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${siteUrl()}/login`, ...(provider === 'azure' ? { scopes: 'email' } : {}) },
    });
    if (error) {
      toast.error(/provider is not enabled/i.test(error.message) ? 'This sign-in option is not enabled yet. Use email and password.' : errorMessage(error));
      setBusy(null);
    }
  };
  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-slate-200" />or continue with<span className="h-px flex-1 bg-slate-200" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => go('google')} disabled={!!busy} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-navy-900 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Google />{busy === 'google' ? 'Redirecting…' : 'Google'}</button>
        <button type="button" onClick={() => go('azure')} disabled={!!busy} className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-navy-900 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Microsoft />{busy === 'azure' ? 'Redirecting…' : 'Microsoft'}</button>
      </div>
    </div>
  );
}
