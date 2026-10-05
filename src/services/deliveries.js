import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { PAGE_SIZE } from '@/config/site';
import { sanitizeSearch } from '@/utils/format';
import { toDeliveryRpcArgs } from '@/features/deliveries/validation';

export const DELIVERY_SELECT = `
  *,
  business:businesses(id, name, phone, owner_id, category, logo_url, address),
  rider:profiles!deliveries_rider_id_fkey(id, full_name, phone, avatar_url),
  customer:profiles!deliveries_customer_user_id_fkey(id, full_name, phone, email)
`;

/**
 * scope: { customer_user_id } | { rider_id } | { business_id } | {} (admin)
 * RLS already restricts rows; the explicit scope keeps each dashboard focused on its role.
 */
export async function listDeliveries({ scope = {}, statuses = null, search = '', page = 1, pageSize = PAGE_SIZE, from, to, order = 'created_at' } = {}) {
  let q = supabase.from('deliveries').select(DELIVERY_SELECT, { count: 'exact' });
  Object.entries(scope).forEach(([k, v]) => { q = q.eq(k, v); });
  if (statuses?.length) q = q.in('status', statuses);
  const s = sanitizeSearch(search);
  if (s) q = q.or(`code.ilike.%${s}%,recipient_name.ilike.%${s}%,dropoff_address.ilike.%${s}%,pickup_address.ilike.%${s}%`);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  const start = (page - 1) * pageSize;
  const { data, error, count } = await q.order(order, { ascending: false }).range(start, start + pageSize - 1);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

export async function countDeliveries(scope = {}, statuses = null) {
  let q = supabase.from('deliveries').select('id', { count: 'exact', head: true });
  Object.entries(scope).forEach(([k, v]) => { q = q.eq(k, v); });
  if (statuses?.length) q = q.in('status', statuses);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

// Lightweight rows for analytics (bounded by date range)
export async function deliveriesForAnalytics(scope, fromISO, toISO) {
  let q = supabase.from('deliveries').select('id, status, created_at, accepted_at, delivered_at').limit(5000);
  Object.entries(scope).forEach(([k, v]) => { q = q.eq(k, v); });
  return unwrap(await q.gte('created_at', fromISO).lte('created_at', toISO));
}

export async function getDelivery(id) {
  const delivery = unwrap(await supabase.from('deliveries').select(DELIVERY_SELECT).eq('id', id).maybeSingle());
  if (!delivery) return null;
  const history = unwrap(await supabase.from('delivery_status_history').select('*').eq('delivery_id', id).order('created_at'));
  return { ...delivery, history };
}

export const createDeliveryRequest = async (businessId, values) =>
  unwrap(await supabase.rpc('create_delivery_request', { p_business_id: businessId, ...toDeliveryRpcArgs(values) }));

export const createBusinessDelivery = async (businessCustomerId, values) =>
  unwrap(await supabase.rpc('create_business_delivery', { p_business_customer_id: businessCustomerId, ...toDeliveryRpcArgs(values) }));

export const reviewRequest = async (id, accept, reason = null) =>
  unwrap(await supabase.rpc('review_delivery_request', { p_delivery_id: id, p_accept: accept, p_reason: reason || null }));

export const assignRider = async (id, riderId) =>
  unwrap(await supabase.rpc('assign_rider', { p_delivery_id: id, p_rider_id: riderId }));

export const respondToJob = async (id, accept) =>
  unwrap(await supabase.rpc('respond_to_job', { p_delivery_id: id, p_accept: accept }));

export const advanceDelivery = async (id, status) =>
  unwrap(await supabase.rpc('advance_delivery', { p_delivery_id: id, p_status: status }));

export const completeDelivery = async (id, proofPath, notes) =>
  unwrap(await supabase.rpc('complete_delivery', { p_delivery_id: id, p_proof_path: proofPath || null, p_notes: notes || null }));

export const cancelDelivery = async (id, reason) =>
  unwrap(await supabase.rpc('cancel_delivery', { p_delivery_id: id, p_reason: reason || null }));

export const rateDelivery = async (id, rating, comment) =>
  unwrap(await supabase.rpc('rate_delivery', { p_delivery_id: id, p_rating: rating, p_comment: comment || null }));

export async function getRating(deliveryId) {
  return unwrap(await supabase.from('delivery_ratings').select('*').eq('delivery_id', deliveryId).maybeSingle());
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImage(file, maxMb) {
  if (!file) return 'Choose an image';
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image';
  if (file.size > maxMb * 1024 * 1024) return `Image must be under ${maxMb} MB`;
  return null;
}

export async function uploadProof(deliveryId, file) {
  const problem = validateImage(file, 5);
  if (problem) throw new Error(problem);
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${deliveryId}/proof-${Date.now()}.${ext}`;
  unwrap(await supabase.storage.from('proofs').upload(path, file, { contentType: file.type, upsert: false }));
  return path;
}

export async function getProofUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
