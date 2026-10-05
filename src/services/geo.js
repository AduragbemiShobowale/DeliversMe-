// Browser geolocation + best-effort geocoding (OpenStreetMap Nominatim, no key required).
// Nominatim's usage policy allows light, user-triggered use; heavy use needs a self-hosted or paid geocoder.

export function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 10000 }) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not available in this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? 'Location permission was denied' : 'Could not get your location')),
      options,
    );
  });
}

export async function reverseGeocode({ lat, lng }) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.display_name || null;
  } catch {
    return null;
  }
}

export async function geocodeAddress(address) {
  if (!address || address.trim().length < 5) return null;
  try {
    const q = encodeURIComponent(`${address}, Lagos`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ng&q=${q}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const [hit] = await res.json();
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}
