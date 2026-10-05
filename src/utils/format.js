export function formatDateTime(value, now = new Date()) {
  if (!value) return '—';
  const d = new Date(value);
  const time = d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(value, now = Date.now()) {
  if (!value) return '';
  const s = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(value);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName = '') {
  return fullName.trim().split(/\s+/)[0] || '';
}

export function initials(fullName = '') {
  return fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

// Great-circle distance in km.
export function distanceKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatKm(km) {
  if (km == null || Number.isNaN(km)) return '—';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// Straight-line estimate for Lagos traffic: ~18 km/h average + 5 min handling, shown as a range.
export function estimateMinutes(km) {
  if (km == null) return null;
  const base = Math.round((km / 18) * 60 + 5);
  return [base, Math.round(base * 1.6)];
}

export function mapsDirectionsUrl(address, lat, lng) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address || '');
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function telHref(phone) {
  return phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined;
}

export function toISODate(d) {
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Escape user input for PostgREST .or()/.ilike() filters (commas, parentheses and wildcards are syntax there).
export function sanitizeSearch(q = '') {
  return q.replace(/[%_,()*\\]/g, ' ').trim().slice(0, 60);
}
