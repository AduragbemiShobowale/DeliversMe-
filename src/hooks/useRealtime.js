import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Subscribe to postgres_changes on a table. Supabase Realtime applies RLS, so users only
 * receive events for rows they are allowed to read.
 */
export function useRealtime({ table, filter, event = '*', onChange, enabled = true, channelKey }) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return undefined;
    const channel = supabase
      .channel(channelKey || `${table}:${filter || 'all'}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => cb.current?.(payload))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table, filter, event, enabled, channelKey]);
}
