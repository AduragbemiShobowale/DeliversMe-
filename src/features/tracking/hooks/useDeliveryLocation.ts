import { useEffect, useState } from "react";
import { supabase } from "../../../shared/lib/supabase";

interface LatestLocation {
  lat: number;
  lng: number;
  recorded_at: string;
}

/**
 * Latest known position for a delivery, kept live via Realtime (Stage 15's
 * per-delivery location channel) rather than TanStack Query -- per Stage
 * 18's explicit decision, GPS pings are lightweight local state, not
 * routed through the full query-cache machinery given their write
 * frequency.
 */
export function useDeliveryLocation(deliveryId: string | undefined) {
  const [location, setLocation] = useState<LatestLocation | null>(null);

  useEffect(() => {
    if (!deliveryId) return;
    let active = true;

    async function loadInitial() {
      const { data } = await supabase
        .from("delivery_locations")
        .select("lat, lng, recorded_at")
        .eq("delivery_id", deliveryId!)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active && data) setLocation(data);
    }
    loadInitial();

    const channel = supabase
      .channel(`delivery:${deliveryId}:location`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_locations", filter: `delivery_id=eq.${deliveryId}` },
        (payload) => {
          const row = payload.new as LatestLocation;
          setLocation(row);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

  return location;
}
