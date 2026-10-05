import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/common/Button';
import { SuccessModal } from '@/components/common/Modal';
import { Input } from '@/components/forms/Fields';
import { ROLE_HOME } from '@/config/site';
import { errorMessage } from '@/lib/errors';
import { OtpInput } from './OtpInput';

const COOLDOWN = 60;

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile, accountLoading } = useAuth();
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(COOLDOWN);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = async (e) => {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error('Enter the email you signed up with'); return; }
    if (code.length !== 6) { toast.error('Enter the 6-digit code from your email'); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    setBusy(false);
    if (error) { toast.error(/expired|invalid/i.test(error.message) ? 'That code is invalid or has expired. Request a new one.' : errorMessage(error)); return; }
    setDone(true);
  };

  const resend = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error('Enter your email first'); return; }
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success('A new code is on its way');
    setWait(COOLDOWN);
  };

  const mm = String(Math.floor(wait / 60)).padStart(2, '0');
  const ss = String(wait % 60).padStart(2, '0');
  const dashboard = profile ? (profile.onboarded ? ROLE_HOME[profile.role] : '/onboarding') : null;

  return (
    <AuthLayout headline="Almost There!" sub="We’ve sent a 6-digit verification code to your email." backTo="/register" backLabel="Back">
      <h1 className="text-3xl font-bold text-navy-900">Verify Your Email</h1>
      {params.get('email') ? (
        <p className="mt-1 text-sm text-slate-500">Enter the 6-digit code we sent to <strong className="text-navy-900">{email}</strong></p>
      ) : (
        <Input className="mt-4" label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} />
      )}
      <form className="mt-8" onSubmit={verify}>
        <OtpInput value={code} onChange={setCode} disabled={busy} />
        <p className="mt-5 text-center text-sm text-slate-600">
          Didn’t receive the code?{' '}
          <button type="button" onClick={resend} disabled={wait > 0} className="font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline">
            Resend{wait > 0 ? ` (${mm}:${ss})` : ''}
          </button>
        </p>
        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>Verify &amp; Continue</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">Wrong email? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Start again</Link></p>

      <SuccessModal open={done} title="Account Created Successfully!" message="Welcome to DeliverSME. Let’s get you to your dashboard."
        actions={<Button size="lg" loading={accountLoading || !dashboard} onClick={() => navigate(dashboard, { replace: true })}>Go to Dashboard</Button>} />
    </AuthLayout>
  );
}
