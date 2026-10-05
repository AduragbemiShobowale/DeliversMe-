import { useRef, useState } from 'react';
import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Camera, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers/AuthProvider';
import { Card, PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { Toggle } from '@/components/common/Controls';
import { ConfirmDialog } from '@/components/common/Modal';
import { Input, PasswordInput, Select, Textarea } from '@/components/forms/Fields';
import { updateBusiness, updateProfile, updateRiderProfile, uploadAvatar } from '@/services/profiles';
import { setAvailability } from '@/services/riders';
import { BASE_PATH } from '@/config/routes';
import { BUSINESS_CATEGORIES, ROLE_LABEL, VEHICLE_TYPES, siteUrl } from '@/config/site';
import { normalizePhone, passwordSchema } from '@/features/authentication/validation';
import { phoneRegex } from '@/features/deliveries/validation';
import { errorMessage } from '@/lib/errors';

export const SETTINGS_TABS = {
  customer: [['profile', 'Profile'], ['security', 'Security'], ['notifications', 'Notifications']],
  sme_owner: [['profile', 'Profile'], ['business', 'Business Information'], ['security', 'Security'], ['notifications', 'Notifications']],
  rider: [['profile', 'Profile'], ['vehicle', 'Vehicle & Availability'], ['security', 'Security'], ['notifications', 'Notifications']],
  admin: [['profile', 'Profile'], ['security', 'Security'], ['notifications', 'Notifications']],
};

const optional = (max) => z.string().trim().max(max).optional().or(z.literal(''));
const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z.string().trim().refine((v) => v === '' || phoneRegex.test(v), 'Enter a valid phone number'),
});
const businessSchema = z.object({
  name: z.string().trim().min(2, 'Enter the business name').max(120),
  category: z.enum(BUSINESS_CATEGORIES.map((c) => c.value)),
  tagline: optional(120),
  phone: z.string().trim().refine((v) => v === '' || phoneRegex.test(v), 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
  address: optional(300),
  description: optional(1000),
});
const vehicleSchema = z.object({
  vehicle_type: z.enum(VEHICLE_TYPES.map((v) => v.value)),
  plate_number: z.string().trim().max(20, 'Plate number is too long').optional().or(z.literal('')),
});
const passwordForm = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
const emailForm = z.object({ email: z.string().trim().email('Enter a valid email address') });
const nul = (v) => (v === '' ? null : v);

function Section({ title, description, children }) {
  return (
    <section className="border-b border-slate-100 p-5 last:border-0 sm:p-6">
      <h2 className="font-semibold text-navy-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfileTab() {
  const { user, profile, role, refresh } = useAuth();
  const file = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(profileSchema), values: { full_name: profile.full_name || '', phone: profile.phone || '' },
  });
  const save = async (v) => {
    try { await updateProfile(user.id, { full_name: v.full_name, phone: v.phone ? normalizePhone(v.phone) : null }); await refresh(); toast.success('Profile saved'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try { const url = await uploadAvatar(user.id, f); await updateProfile(user.id, { avatar_url: url }); await refresh(); toast.success('Photo updated'); }
    catch (err) { toast.error(errorMessage(err)); }
    finally { setUploading(false); }
  };
  return (
    <Section title="Profile" description="How you appear to businesses, riders and customers you work with.">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={profile.full_name} src={profile.avatar_url} size="xl" />
        <div>
          <p className="font-semibold text-navy-900">{profile.full_name}</p>
          <p className="text-sm text-slate-500">{ROLE_LABEL[role]}</p>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
          <Button variant="outline-brand" size="sm" className="mt-2" onClick={() => file.current?.click()} loading={uploading}><Camera className="h-4 w-4" />Change Photo</Button>
          <p className="mt-1 text-xs text-slate-500">JPG, PNG or WebP, up to 2 MB.</p>
        </div>
      </div>
      <form className="grid max-w-xl gap-4" onSubmit={handleSubmit(save)} noValidate>
        <Input label="Full Name" error={errors.full_name?.message} {...register('full_name')} />
        <Input label="Email Address" value={profile.email || ''} disabled hint="Change your email in Security." readOnly />
        <Input label="Phone Number" type="tel" error={errors.phone?.message} {...register('phone')} />
        <div><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save Changes</Button></div>
      </form>
    </Section>
  );
}

function BusinessTab() {
  const { business, refresh } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(businessSchema),
    values: {
      name: business?.name || '', category: business?.category || 'other', tagline: business?.tagline || '', phone: business?.phone || '',
      email: business?.email || '', address: business?.address || '', description: business?.description || '',
    },
  });
  if (!business) return <Section title="Business Information"><p className="text-sm text-slate-500">No business is linked to this account.</p></Section>;
  const save = async (v) => {
    try {
      await updateBusiness(business.id, { ...v, tagline: nul(v.tagline), phone: v.phone ? normalizePhone(v.phone) : null, email: nul(v.email), address: nul(v.address), description: nul(v.description) });
      await refresh(); toast.success('Business information saved');
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Section title="Business Information" description="Customers see this when they choose a business to deliver from.">
      <div className="mb-4 flex flex-wrap gap-2">
        {business.is_verified ? <Badge tone="green">Verified business</Badge> : <Badge tone="amber">Awaiting verification</Badge>}
        {!business.is_active && <Badge tone="red">Suspended — hidden from customers</Badge>}
      </div>
      <form className="grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={handleSubmit(save)} noValidate>
        <Input label="Business Name" error={errors.name?.message} {...register('name')} />
        <Select label="Category" options={BUSINESS_CATEGORIES} {...register('category')} />
        <Input className="sm:col-span-2" label="Tagline" placeholder="e.g. Logistics & Supply Chain" error={errors.tagline?.message} {...register('tagline')} />
        <Input label="Business Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
        <Input label="Business Email" type="email" error={errors.email?.message} {...register('email')} />
        <Input className="sm:col-span-2" label="Pickup Address" hint="Pre-fills the pickup address when you create deliveries." error={errors.address?.message} {...register('address')} />
        <Textarea className="sm:col-span-2" label="About the business" rows={3} error={errors.description?.message} {...register('description')} />
        <div><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save Changes</Button></div>
      </form>
    </Section>
  );
}

function VehicleTab() {
  const { rider, setRider } = useAuth();
  const [toggling, setToggling] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(vehicleSchema), values: { vehicle_type: rider?.vehicle_type || 'motorcycle', plate_number: rider?.plate_number || '' },
  });
  if (!rider) return null;
  const save = async (v) => {
    try { setRider(await updateRiderProfile(rider.id, { vehicle_type: v.vehicle_type, plate_number: nul(v.plate_number.toUpperCase()) })); toast.success('Vehicle details saved'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const toggle = async (on) => {
    if (on && !rider.is_verified) { toast.error('Your account must be verified by an administrator before you can go online'); return; }
    setToggling(true);
    try { setRider(await setAvailability(rider.id, on ? 'available' : 'offline')); toast.success(on ? 'You are online' : 'You are offline'); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setToggling(false); }
  };
  return (
    <>
      <Section title="Availability Status" description="When online, businesses can offer you jobs and your location is shared with deliveries you are handling.">
        <div className="max-w-xl"><Toggle label="Receive job offers" description={rider.is_verified ? (rider.availability === 'available' ? 'Online' : 'Offline') : 'Awaiting administrator verification'} checked={rider.availability === 'available'} onChange={toggle} disabled={toggling} /></div>
      </Section>
      <Section title="Vehicle" description="Shown to businesses when they choose a rider.">
        <form className="grid max-w-xl gap-4 sm:grid-cols-2" onSubmit={handleSubmit(save)} noValidate>
          <Select label="Vehicle Type" options={VEHICLE_TYPES} {...register('vehicle_type')} />
          <Input label="Vehicle Plate Number" placeholder="e.g. LAG 123 AB" error={errors.plate_number?.message} {...register('plate_number')} />
          <div><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save Changes</Button></div>
        </form>
      </Section>
    </>
  );
}

function SecurityTab() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmOut, setConfirmOut] = useState(false);
  const pw = useForm({ resolver: zodResolver(passwordForm), defaultValues: { password: '', confirm: '' } });
  const em = useForm({ resolver: zodResolver(emailForm), defaultValues: { email: '' } });
  const changePassword = async ({ password }) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(/reauthenticat|recent/i.test(error.message) ? 'For security, log out and back in, then change your password.' : errorMessage(error)); return; }
    pw.reset(); toast.success('Password changed');
  };
  const changeEmail = async ({ email }) => {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${siteUrl()}/login` });
    if (error) { toast.error(errorMessage(error)); return; }
    em.reset(); toast.success('Check both inboxes to confirm the change');
  };
  return (
    <>
      <Section title="Email Address" description={`Current: ${profile.email}. A confirmation link is sent before the change takes effect.`}>
        <form className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-start" onSubmit={em.handleSubmit(changeEmail)} noValidate>
          <Input className="flex-1" label="New email address" type="email" error={em.formState.errors.email?.message} {...em.register('email')} />
          <Button type="submit" className="sm:mt-7" loading={em.formState.isSubmitting}>Change</Button>
        </form>
      </Section>
      <Section title="Password" description="Use at least 8 characters with a letter, a number and a special character.">
        <form className="grid max-w-xl gap-4" onSubmit={pw.handleSubmit(changePassword)} noValidate>
          <PasswordInput label="New Password" autoComplete="new-password" error={pw.formState.errors.password?.message} {...pw.register('password')} />
          <PasswordInput label="Confirm New Password" autoComplete="new-password" error={pw.formState.errors.confirm?.message} {...pw.register('confirm')} />
          <div><Button type="submit" loading={pw.formState.isSubmitting}>Update Password</Button></div>
        </form>
      </Section>
      <Section title="Session">
        <Button variant="outline-danger" onClick={() => setConfirmOut(true)}><LogOut className="h-4 w-4" />Log Out</Button>
      </Section>
      <ConfirmDialog open={confirmOut} onClose={() => setConfirmOut(false)} title="Log out?" message="You will need to sign in again to use DeliverSME." confirmLabel="Log out"
        onConfirm={async () => { await signOut(); navigate('/login'); }} />
    </>
  );
}

function NotificationsTab() {
  const { user, profile, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const prefs = profile.notification_prefs || { in_app: true };
  const set = async (inApp) => {
    setBusy(true);
    try { await updateProfile(user.id, { notification_prefs: { ...prefs, in_app: inApp } }); await refresh(); toast.success('Preference saved'); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <Section title="Notifications" description="Choose how DeliverSME keeps you updated.">
      <div className="max-w-xl space-y-4">
        <Toggle label="In-app notifications" description="Delivery requests, job offers, status changes and completions." checked={prefs.in_app !== false} onChange={set} disabled={busy} />
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Email and SMS delivery alerts are not part of this version. Account emails (verification, password reset) are always sent.</p>
      </div>
    </Section>
  );
}

const PANELS = { profile: ProfileTab, business: BusinessTab, vehicle: VehicleTab, security: SecurityTab, notifications: NotificationsTab };

export default function SettingsPage() {
  const { tab } = useParams();
  const { role } = useAuth();
  const tabs = SETTINGS_TABS[role] || [];
  if (!tabs.some(([k]) => k === tab)) return <Navigate to={`${BASE_PATH[role]}/settings/profile`} replace />;
  const Panel = PANELS[tab];
  return (
    <div>
      <PageHeader title="Settings" description="Manage your account and preferences." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
          {tabs.map(([k, label]) => (
            <NavLink key={k} to={`${BASE_PATH[role]}/settings/${k}`} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</NavLink>
          ))}
        </nav>
        <Card><Panel /></Card>
      </div>
    </div>
  );
}
