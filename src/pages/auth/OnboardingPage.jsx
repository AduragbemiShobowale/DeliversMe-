import { Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Input, Select } from '@/components/forms/Fields';
import { Button } from '@/components/common/Button';
import { FullPageSpinner } from '@/components/common/Spinner';
import { completeOnboarding } from '@/services/profiles';
import { BUSINESS_CATEGORIES, ROLE_HOME } from '@/config/site';
import { normalizePhone } from '@/features/authentication/validation';
import { phoneRegex } from '@/features/deliveries/validation';
import { errorMessage } from '@/lib/errors';
import { AccountTypePicker } from './AccountTypePicker';

const schema = z.object({
  account_type: z.enum(['sme_owner', 'rider', 'customer']),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number'),
  business_name: z.string().trim().max(120).optional(),
  business_category: z.string().optional(),
}).superRefine((v, ctx) => {
  if (v.account_type === 'sme_owner' && (!v.business_name || v.business_name.length < 2)) ctx.addIssue({ code: 'custom', path: ['business_name'], message: 'Enter your business name' });
});

/** For accounts created via Google/Microsoft: choose an account type once (enforced by complete_onboarding RPC). */
export default function OnboardingPage() {
  const { profile, accountLoading, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema), defaultValues: { account_type: 'customer', phone: profile?.phone || '', business_name: '', business_category: 'retail' },
  });
  if (accountLoading) return <FullPageSpinner />;
  if (profile?.onboarded) return <Navigate to={ROLE_HOME[profile.role]} replace />;
  const type = watch('account_type');

  const onSubmit = async (v) => {
    try {
      const p = await completeOnboarding({ ...v, phone: normalizePhone(v.phone) });
      await refresh();
      toast.success('You are all set');
      navigate(ROLE_HOME[p.role], { replace: true });
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <AuthLayout headline="One more step." sub="Tell us how you will use DeliverSME so we can set up the right dashboard." backTo="/" backLabel="Home">
      <h1 className="text-3xl font-bold text-navy-900">Finish setting up</h1>
      <p className="mt-1 text-sm text-slate-500">Signed in as {profile?.email}. This choice can only be made once.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AccountTypePicker value={type} onChange={(v) => setValue('account_type', v)} />
        <Input label="Phone Number" type="tel" placeholder="e.g. 0802 123 4567" error={errors.phone?.message} {...register('phone')} />
        {type === 'sme_owner' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Business Name" error={errors.business_name?.message} {...register('business_name')} />
            <Select label="Category" options={BUSINESS_CATEGORIES} {...register('business_category')} />
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Continue</Button>
        <Button variant="ghost" className="w-full" onClick={signOut}>Sign out</Button>
      </form>
    </AuthLayout>
  );
}
