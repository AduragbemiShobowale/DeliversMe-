import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { validateImage } from './deliveries';

export async function fetchAccount(userId) {
  const profile = unwrap(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
  if (!profile) return { profile: null, business: null, rider: null };
  const [business, rider] = await Promise.all([
    profile.role === 'sme_owner'
      ? supabase.from('businesses').select('*').eq('owner_id', userId).maybeSingle().then(unwrap)
      : null,
    profile.role === 'rider'
      ? supabase.from('rider_profiles').select('*').eq('id', userId).maybeSingle().then(unwrap)
      : null,
  ]);
  return { profile, business, rider };
}

export const updateProfile = async (id, values) =>
  unwrap(await supabase.from('profiles').update(values).eq('id', id).select().single());

export const updateBusiness = async (id, values) =>
  unwrap(await supabase.from('businesses').update(values).eq('id', id).select().single());

export const updateRiderProfile = async (id, values) =>
  unwrap(await supabase.from('rider_profiles').update(values).eq('id', id).select().single());

export async function uploadAvatar(userId, file) {
  const problem = validateImage(file, 2);
  if (problem) throw new Error(problem);
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  unwrap(await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true }));
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export const completeOnboarding = async (values) =>
  unwrap(await supabase.rpc('complete_onboarding', {
    p_account_type: values.account_type,
    p_business_name: values.business_name || null,
    p_business_category: values.business_category || 'other',
    p_phone: values.phone || null,
  }));
