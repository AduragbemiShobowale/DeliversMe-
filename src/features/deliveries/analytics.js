const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Pure analytics over delivery rows ({status, created_at, accepted_at, delivered_at}). */
export function computeAnalytics(rows) {
  const total = rows.length;
  const delivered = rows.filter((r) => r.status === 'delivered');
  const failed = rows.filter((r) => r.status === 'cancelled' || r.status === 'rejected').length;
  const finished = delivered.length + failed;
  const successRate = finished ? Math.round((delivered.length / finished) * 100) : null;
  const durations = delivered
    .filter((r) => r.accepted_at && r.delivered_at)
    .map((r) => (new Date(r.delivered_at) - new Date(r.accepted_at)) / 3600000)
    .filter((h) => h >= 0);
  const avgHours = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;
  const counts = new Array(7).fill(0);
  rows.forEach((r) => { counts[(new Date(r.created_at).getDay() + 6) % 7] += 1; });
  return { total, completed: delivered.length, successRate, avgHours, byWeekday: DAYS.map((day, i) => ({ day, count: counts[i] })) };
}
