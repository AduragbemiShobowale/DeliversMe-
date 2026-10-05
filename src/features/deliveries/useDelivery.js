import { useCallback } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { useRealtime } from '@/hooks/useRealtime';
import { getDelivery } from '@/services/deliveries';

/** Loads a delivery with history and keeps it live via Realtime (status + rider position). */
export function useDelivery(id) {
  const q = useAsync(() => getDelivery(id), [id]);
  const refresh = useCallback(() => q.reload({ silent: true }), [q]);
  useRealtime({ table: 'deliveries', filter: `id=eq.${id}`, channelKey: `delivery:${id}`, onChange: refresh, enabled: Boolean(id) });
  const riderId = q.data?.rider_id;
  const live = q.data && !['delivered', 'cancelled', 'rejected'].includes(q.data.status);
  useRealtime({
    table: 'rider_profiles', filter: riderId ? `id=eq.${riderId}` : undefined, channelKey: `rider-loc:${riderId}:${id}`,
    enabled: Boolean(riderId && live),
    onChange: (p) => {
      const n = p.new;
      if (n?.last_lat != null) q.setData({ ...q.data, riderLocation: { lat: n.last_lat, lng: n.last_lng, at: n.last_location_at } });
    },
  });
  return { ...q, refresh };
}
