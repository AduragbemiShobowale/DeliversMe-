import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Input, PasswordInput } from '@/components/forms/Fields';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { emailOnlySchema, loginSchema } from '@/features/authentication/validation';
import { siteUrl } from '@/config/site';
import { errorMessage } from '@/lib/errors';
import { OAuthButtons } from './OAuthButtons';

function ForgotPassword({ open, onClose, defaultEmail }) {
  const [sentTo, setSentTo] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(emailOnlySchema), values: { email: defaultEmail || '' } });
  const close = () => { setSentTo(null); reset(); onClose(); };
  const onSubmit = async ({ email }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/reset-password` });
    // Same result whether or not the account exists, so this form cannot be used to discover accounts.
    if (error && error.status !== 400) { toast.error(errorMessage(error)); return; }
    setSentTo(email);
  };
  if (sentTo) {
    return (
      <Modal open={open} onClose={close} size="sm">
        <div className="flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600"><Mail className="h-8 w-8" /></span>
          <h2 className="mt-4 text-xl font-bold text-navy-900">Reset Link Sent!</h2>
          <p className="mt-2 text-sm text-slate-600">If an account exists for <strong>{sentTo}</strong>, we’ve sent a password reset link. Please check your inbox (and spam folder).</p>
          <Button className="mt-6 w-full" onClick={close}>Back to Login</Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open={open} onClose={close} title="Reset Your Password" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <p className="text-sm text-slate-600">Enter your email address and we’ll send you a link to reset your password.</p>
        <Input className="mt-4" label="Email Address" type="email" placeholder="Enter your email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Send Reset Link</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [forgot, setForgot] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) { toast.success('Welcome back'); return; } // GuestOnly redirects to the role dashboard
    if (/email not confirmed/i.test(error.message)) {
      await supabase.auth.resend({ type: 'signup', email });
      toast('Verify your email first. We sent you a new code.');
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
      return;
    }
    toast.error(/invalid login credentials/i.test(error.message) ? 'Incorrect email or password' : errorMessage(error));
  };

  return (
    <AuthLayout headline="Connecting People. Powering SMEs." sub="Smarter deliveries. Stronger businesses. A more connected Nigeria.">
      <h1 className="text-3xl font-bold text-navy-900">Welcome Back</h1>
      <p className="mt-1 text-sm text-slate-500">Log in to your account to continue</p>
      <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Input label="Email Address" type="email" placeholder="Enter your email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" placeholder="Enter your password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="text-right"><button type="button" onClick={() => setForgot(true)} className="text-sm font-medium text-brand-600 hover:underline">Forgot password?</button></div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Log In</Button>
      </form>
      <OAuthButtons />
      <p className="mt-6 text-center text-sm text-slate-600">Don’t have an account? <Link to="/register" className="font-semibold text-brand-600 hover:underline">Create account</Link></p>
      <ForgotPassword open={forgot} onClose={() => setForgot(false)} defaultEmail={watch('email')} />
    </AuthLayout>
  );
}
