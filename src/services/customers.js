import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { PAGE_SIZE } from '@/config/site';
import { sanitizeSearch } from '@/utils/format';

const clean = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? null : x]));

export async function listCustomers(businessId, { search = '', page = 1, pageSize = PAGE_SIZE } = {}) {
  let q = supabase.from('business_customers').select('*', { count: 'exact' }).eq('business_id', businessId);
  const s = sanitizeSearch(search);
  if (s) q = q.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,address.ilike.%${s}%`);
  const start = (page - 1) * pageSize;
  const { data, error, count } = await q.order('full_name').range(start, start + pageSize - 1);
  if (error) throw error;
  return { rows: data, count };
}

export const createCustomer = async (businessId, values) =>
  unwrap(await supabase.from('business_customers').insert({ business_id: businessId, ...clean(values) }).select().single());

export const updateCustomer = async (id, values) =>
  unwrap(await supabase.from('business_customers').update(clean(values)).eq('id', id).select().single());

export const deleteCustomer = async (id) => unwrap(await supabase.from('business_customers').delete().eq('id', id));

export const getCustomer = async (id) =>
  unwrap(await supabase.from('business_customers').select('*').eq('id', id).maybeSingle());
