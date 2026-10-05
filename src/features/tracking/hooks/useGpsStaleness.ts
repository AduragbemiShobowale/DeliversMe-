export type GpsStalenessTier = "fresh" | "updating" | "stale";

/**
 * Three-tier calm-disclosure ladder (Stage 13, corrected):
 *   0-5 min: fresh, no messaging beyond the timestamp
 *   5-15 min: neutral "updating" state
 *   15+ min: amber warning, still non-alarming, actionable suggestion only
 * Shared as logic (Stage 19) since Owner and Rider render it differently
 * but must agree on the same thresholds.
 */
export function useGpsStaleness(lastUpdatedAt: string | null): {
  tier: GpsStalenessTier;
  minutesAgo: number | null;
} {
  if (!lastUpdatedAt) return { tier: "stale", minutesAgo: null };
  const minutesAgo = Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 60000);
  if (minutesAgo < 5) return { tier: "fresh", minutesAgo };
  if (minutesAgo < 15) return { tier: "updating", minutesAgo };
  return { tier: "stale", minutesAgo };
}
