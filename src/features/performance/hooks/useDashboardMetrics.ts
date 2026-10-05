import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";
import { useAuth } from "../../../app/AuthProvider";

/**
 * Computed at query time from deliveries -- no metrics table (Stage 8/20:
 * "do not create unnecessary metric storage unless performance testing
 * demonstrates a need"). Partial-rating handling per Stage 5: average is
 * over rated deliveries only, displayed alongside the coverage count.
 */
export function useDashboardMetrics() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["dashboard_metrics", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: all, error } = await supabase
        .from("deliveries")
        .select("status, rating, created_at, accepted_at, delivered_at, scheduled_window_end");
      if (error) throw error;

      const rows = all ?? [];
      const todaysCount = rows.filter((r) => new Date(r.created_at) >= today).length;
      const delivered = rows.filter((r) => r.status === "delivered");
      const failed = rows.filter((r) => r.status === "failed");
      const completionRate =
        delivered.length + failed.length > 0
          ? Math.round((delivered.length / (delivered.length + failed.length)) * 100)
          : null;

      const timedDeliveries = delivered.filter((r) => r.accepted_at && r.delivered_at);
      const avgMinutes =
        timedDeliveries.length > 0
          ? Math.round(
              timedDeliveries.reduce(
                (sum, r) => sum + (new Date(r.delivered_at!).getTime() - new Date(r.accepted_at!).getTime()) / 60000,
                0
              ) / timedDeliveries.length
            )
          : null;

      const rated = rows.filter((r) => r.rating !== null);
      const avgRating =
        rated.length > 0 ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 10) / 10 : null;

      return {
        todaysCount,
        completionRate,
        avgMinutes,
        avgRating,
        ratedCount: rated.length,
        completedCount: delivered.length + failed.length,
      };
    },
  });
}
