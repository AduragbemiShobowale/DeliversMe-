import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { sanitizeSearch } from '@/utils/format';

export const listRiders = async (search = '') =>
  unwrap(await supabase.rpc('list_riders', { p_search: sanitizeSearch(search) || null }));

export function riderStatus(r) {
  if (!r) return 'offline';
  if (r.availability !== 'available') return 'offline';
  return Number(r.active_jobs) > 0 ? 'busy' : 'available';
}

export const setAvailability = async (riderId, availability) =>
  unwrap(await supabase.from('rider_profiles').update({ availability }).eq('id', riderId).select().single());

export const updateLocation = async (riderId, lat, lng) =>
  unwrap(await supabase.from('rider_profiles').update({ last_lat: lat, last_lng: lng }).eq('id', riderId));

export const getRiderLocation = async (riderId) =>
  unwrap(await supabase.from('rider_profiles').select('last_lat, last_lng, last_location_at').eq('id', riderId).maybeSingle());
