import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../shared/lib/supabase";

export type GpsPermissionState = "idle" | "requesting" | "granted" | "denied";

/**
 * Rider-side location broadcasting -- Geolocation API + direct
 * delivery_locations insert (Stage 18: not RPC-wrapped, for latency).
 * Only active while `enabled` is true (i.e. delivery status = in_transit,
 * per the RLS policy's own status check -- see 0011).
 *
 * Wake Lock is best-effort: not all browsers support it, and it silently
 * no-ops where unsupported rather than blocking the rest of the flow.
 */
export function useGpsBroadcast(deliveryId: string | undefined, riderId: string | undefined, enabled: boolean) {
  const [permission, setPermission] = useState<GpsPermissionState>("idle");
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || !deliveryId || !riderId) return;
    if (!("geolocation" in navigator)) {
      setPermission("denied");
      return;
    }

    setPermission("requesting");

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        setPermission("granted");
        await supabase.from("delivery_locations").insert({
          delivery_id: deliveryId,
          rider_id: riderId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => setPermission("denied"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );

    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock.request("screen").then((lock: WakeLockSentinel) => {
        wakeLockRef.current = lock;
      }).catch(() => {
        // Unsupported or denied -- not fatal, just means the screen may sleep.
      });
    }

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [enabled, deliveryId, riderId]);

  return { permission };
}
