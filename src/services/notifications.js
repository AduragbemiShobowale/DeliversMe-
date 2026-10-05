import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import { PAGE_SIZE } from '@/config/site';

export async function listNotifications(userId, { unreadOnly = false, page = 1, pageSize = PAGE_SIZE } = {}) {
  let q = supabase.from('notifications').select('*', { count: 'exact' }).eq('user_id', userId);
  if (unreadOnly) q = q.is('read_at', null);
  const start = (page - 1) * pageSize;
  const { data, error, count } = await q.order('created_at', { ascending: false }).range(start, start + pageSize - 1);
  if (error) throw error;
  return { rows: data, count };
}

export async function unreadCount(userId) {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).is('read_at', null);
  if (error) throw error;
  return count || 0;
}

export const markRead = async (id) =>
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id));

export const markAllRead = async (userId) =>
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null));

export const deleteNotification = async (id) => unwrap(await supabase.from('notifications').delete().eq('id', id));
