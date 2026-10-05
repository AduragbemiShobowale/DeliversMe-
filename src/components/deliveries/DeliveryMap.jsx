import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LAGOS_CENTER } from '@/config/site';

const pin = (color, label) => L.divIcon({
  className: '',
  html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:9999px;background:${color};color:#fff;font:700 12px Inter,sans-serif;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${label}</span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
const ICONS = { pickup: pin('#16A34A', 'P'), dropoff: pin('#DC2626', 'D'), rider: pin('#0A5CF5', 'R') };

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

/** points: { pickup:{lat,lng,label}, dropoff:{...}, rider:{...} } — any may be missing. */
export function DeliveryMap({ pickup, dropoff, rider, className = 'h-72' }) {
  const markers = useMemo(() => [
    ['pickup', pickup], ['dropoff', dropoff], ['rider', rider],
  ].filter(([, p]) => p && p.lat != null && p.lng != null), [pickup, dropoff, rider]);
  const points = useMemo(() => markers.map(([, p]) => [p.lat, p.lng]), [markers]);
  const route = [pickup, rider, dropoff].filter((p) => p && p.lat != null).map((p) => [p.lat, p.lng]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${className}`}>
      <MapContainer center={LAGOS_CENTER} zoom={11} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#0A5CF5', weight: 4, opacity: 0.7, dashArray: '6 8' }} />}
        {markers.map(([k, p]) => (
          <Marker key={k} position={[p.lat, p.lng]} icon={ICONS[k]}>
            <Tooltip>{p.label || k}</Tooltip>
          </Marker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
      {!markers.length && (
        <p className="pointer-events-none absolute inset-x-3 bottom-3 z-[400] rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-600 shadow">
          Map pins appear when addresses are located or the rider shares their location.
        </p>
      )}
    </div>
  );
}
