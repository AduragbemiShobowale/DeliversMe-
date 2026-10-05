import { useEffect, useRef, useState } from 'react';
import { updateLocation } from '@/services/riders';

/**
 * While a rider is online, share their position so customers and SMEs can follow active deliveries.
 * Writes at most once every `intervalMs` to limit database traffic.
 */
export function useRiderLocation(riderId, enabled, intervalMs = 20000) {
  const [status, setStatus] = useState('idle');
  const last = useRef(0);
  useEffect(() => {
    if (!enabled || !riderId || !('geolocation' in navigator)) {
      setStatus(enabled && !('geolocation' in navigator) ? 'unsupported' : 'idle');
      return undefined;
    }
    setStatus('waiting');
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus('sharing');
        const now = Date.now();
        if (now - last.current < intervalMs) return;
        last.current = now;
        updateLocation(riderId, pos.coords.latitude, pos.coords.longitude).catch(() => setStatus('error'));
      },
      (err) => setStatus(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [riderId, enabled, intervalMs]);
  return status;
}
