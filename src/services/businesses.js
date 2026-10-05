import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { sanitizeSearch } from '@/utils/format';

export const listBusinesses = async (search = '', category = '') =>
  unwrap(await supabase.rpc('list_businesses', { p_search: sanitizeSearch(search) || null, p_category: category || null }));

export const getBusiness = async (id) =>
  unwrap(await supabase.from('businesses').select('id, name, category, tagline, phone, address, logo_url, is_verified').eq('id', id).maybeSingle());

// Businesses a customer has sent requests to ("My Businesses")
export async function customerBusinesses(userId) {
  const rows = unwrap(await supabase
    .from('deliveries')
    .select('created_at, status, business:businesses(id, name, category, tagline, phone, logo_url)')
    .eq('customer_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500));
  const map = new Map();
  rows.forEach((r) => {
    if (!r.business) return;
    const cur = map.get(r.business.id) || { ...r.business, deliveries: 0, last: r.created_at };
    cur.deliveries += 1;
    map.set(r.business.id, cur);
  });
  return [...map.values()];
}
