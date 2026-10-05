import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { PAGE_SIZE } from '@/config/site';
import { sanitizeSearch } from '@/utils/format';

async function paged(q, page, pageSize) {
  const start = (page - 1) * pageSize;
  const { data, error, count } = await q.range(start, start + pageSize - 1);
  if (error) throw error;
  return { rows: data, count };
}

export function listUsers({ search = '', role = '', page = 1, pageSize = PAGE_SIZE } = {}) {
  let q = supabase.from('profiles').select('*', { count: 'exact' });
  if (role) q = q.eq('role', role);
  const s = sanitizeSearch(search);
  if (s) q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`);
  return paged(q.order('created_at', { ascending: false }), page, pageSize);
}

export function listAllBusinesses({ search = '', page = 1, pageSize = PAGE_SIZE } = {}) {
  let q = supabase.from('businesses').select('*, owner:profiles!businesses_owner_id_fkey(full_name, email)', { count: 'exact' });
  const s = sanitizeSearch(search);
  if (s) q = q.ilike('name', `%${s}%`);
  return paged(q.order('created_at', { ascending: false }), page, pageSize);
}

export function listMessages({ status = '', page = 1, pageSize = PAGE_SIZE } = {}) {
  let q = supabase.from('contact_messages').select('*', { count: 'exact' });
  if (status) q = q.eq('status', status);
  return paged(q.order('created_at', { ascending: false }), page, pageSize);
}

export const setMessageStatus = async (id, status) =>
  unwrap(await supabase.from('contact_messages').update({ status }).eq('id', id));

export const setUserRole = async (id, role) => unwrap(await supabase.rpc('admin_set_user_role', { p_user_id: id, p_role: role }));
export const setUserActive = async (id, active) => unwrap(await supabase.rpc('admin_set_user_active', { p_user_id: id, p_active: active }));
export const verifyRider = async (id, verified) => unwrap(await supabase.rpc('admin_verify_rider', { p_rider_id: id, p_verified: verified }));
export const setBusinessStatus = async (id, verified, active) =>
  unwrap(await supabase.rpc('admin_set_business_status', { p_business_id: id, p_verified: verified, p_active: active }));

async function headCount(table, apply = (q) => q) {
  const { count, error } = await apply(supabase.from(table).select('*', { count: 'exact', head: true }));
  if (error) throw error;
  return count || 0;
}

export async function platformStats() {
  const [customers, smes, riders, unverifiedRiders, businesses, deliveries, active, delivered, newMessages] = await Promise.all([
    headCount('profiles', (q) => q.eq('role', 'customer')),
    headCount('profiles', (q) => q.eq('role', 'sme_owner')),
    headCount('profiles', (q) => q.eq('role', 'rider')),
    headCount('rider_profiles', (q) => q.eq('is_verified', false)),
    headCount('businesses'),
    headCount('deliveries'),
    headCount('deliveries', (q) => q.in('status', ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'])),
    headCount('deliveries', (q) => q.eq('status', 'delivered')),
    headCount('contact_messages', (q) => q.eq('status', 'new')),
  ]);
  return { customers, smes, riders, unverifiedRiders, businesses, deliveries, active, delivered, newMessages };
}
