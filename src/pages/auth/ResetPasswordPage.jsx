import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { PasswordInput } from '@/components/forms/Fields';
import { Button } from '@/components/common/Button';
import { SuccessModal } from '@/components/common/Modal';
import { FullPageSpinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/States';
import { resetPasswordSchema } from '@/features/authentication/validation';
import { errorMessage } from '@/lib/errors';
import { PasswordRules } from './PasswordRules';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user, loading, clearRecovery, signOut } = useAuth();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirm: '' } });

  if (loading) return <FullPageSpinner />;

  const onSubmit = async ({ password }) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(errorMessage(error)); return; }
    clearRecovery();
    setDone(true);
  };
  const toLogin = async () => { await signOut(); navigate('/login', { replace: true }); };

  return (
    <AuthLayout headline="A Fresh Start is Just a Click Away." sub="Reset your password and get back to what matters." backTo="/login" backLabel="Back to Login">
      {!user && !done ? (
        <EmptyState title="This reset link is invalid or has expired" message="Request a new link from the login page. Links can only be used once."
          action={<Button to="/login">Back to Login</Button>} />
      ) : (
        <>
          <h1 className="text-3xl font-bold text-navy-900">Set a New Password</h1>
          <p className="mt-1 text-sm text-slate-500">Create a new password for your account.</p>
          <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <PasswordInput label="New Password" placeholder="Enter new password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
              <PasswordRules value={watch('password')} />
            </div>
            <PasswordInput label="Confirm New Password" placeholder="Confirm new password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Reset Password</Button>
          </form>
        </>
      )}
      <SuccessModal open={done} title="Password Updated!" message="Your password has been reset successfully. You can now log in to your account."
        actions={<Button size="lg" onClick={toLogin}>Log In</Button>} />
    </AuthLayout>
  );
}
