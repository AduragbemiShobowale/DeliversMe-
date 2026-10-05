import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Checkbox, Input, PasswordInput, Select } from '@/components/forms/Fields';
import { Button } from '@/components/common/Button';
import { normalizePhone, registerSchema } from '@/features/authentication/validation';
import { BUSINESS_CATEGORIES, VEHICLE_TYPES, siteUrl } from '@/config/site';
import { errorMessage } from '@/lib/errors';
import { AccountTypePicker } from './AccountTypePicker';
import { PasswordRules } from './PasswordRules';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = ['sme_owner', 'rider', 'customer'].includes(params.get('type')) ? params.get('type') : 'sme_owner';
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { account_type: preset, full_name: '', email: '', phone: '', password: '', business_name: '', business_category: 'retail', vehicle_type: 'motorcycle', terms: false },
  });
  const type = watch('account_type');

  const onSubmit = async (v) => {
    // account_type is only a *request*; the database trigger allowlists customer/sme_owner/rider and never grants admin.
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: `${siteUrl()}/login`,
        data: {
          account_type: v.account_type,
          full_name: v.full_name.trim(),
          phone: normalizePhone(v.phone),
          ...(v.account_type === 'sme_owner' ? { business_name: v.business_name.trim(), business_category: v.business_category } : {}),
          ...(v.account_type === 'rider' ? { vehicle_type: v.vehicle_type } : {}),
        },
      },
    });
    if (error) { toast.error(errorMessage(error)); return; }
    if (data.session) { toast.success('Account created. Welcome to DeliverSME!'); return; } // email confirmation disabled
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) {
      toast.error('An account with this email already exists. Log in or reset your password.');
      return;
    }
    navigate(`/verify-email?email=${encodeURIComponent(v.email)}`);
  };

  return (
    <AuthLayout headline="Join a Smarter Delivery Ecosystem." sub="Sign up and be part of a platform built for SMEs, riders and businesses." backTo="/login" backLabel="Back">
      <h1 className="text-3xl font-bold text-navy-900">Create Your Account</h1>
      <p className="mt-1 text-sm text-slate-500">Let’s get you started. Choose your account type and provide your details.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AccountTypePicker value={type} onChange={(v) => setValue('account_type', v, { shouldValidate: true })} error={errors.account_type?.message} />
        <Input label="Full Name" placeholder="Enter your full name" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
        <Input label="Email Address" type="email" placeholder="Enter your email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input label="Phone Number" type="tel" placeholder="e.g. 0802 123 4567" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
        {type === 'sme_owner' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Business Name" placeholder="e.g. Bisi’s Fabrics" error={errors.business_name?.message} {...register('business_name')} />
            <Select label="Category" options={BUSINESS_CATEGORIES} {...register('business_category')} />
          </div>
        )}
        {type === 'rider' && <Select label="Vehicle Type" options={VEHICLE_TYPES} {...register('vehicle_type')} />}
        <div>
          <PasswordInput label="Password" placeholder="Create a password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <PasswordRules value={watch('password')} />
        </div>
        <Checkbox error={errors.terms?.message} {...register('terms')}
          label={<>I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">Terms of Service</Link> and <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">Privacy Policy</Link></>} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create Account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">Already have an account? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link></p>
    </AuthLayout>
  );
}
