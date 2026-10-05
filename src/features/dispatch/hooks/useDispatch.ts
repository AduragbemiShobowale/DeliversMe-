import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";
import { useAuth } from "../../../app/AuthProvider";

export interface SuggestedRider {
  profile_id: string;
  full_name: string;
  availability_status: "available" | "busy" | "offline";
  active_count: number;
}

/**
 * Suggested Assignment Order (Phase 2 §9 / Stage 15): filter available,
 * sort by fewest active deliveries. Deliberately a plain deterministic
 * sort, not scored/weighted -- see Stage 16's explicit correction against
 * implying a recommendation algorithm.
 */
export function useSuggestedRiders() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["suggested_riders", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<SuggestedRider[]> => {
      const { data: riders, error } = await supabase
        .from("riders")
        .select("profile_id, availability_status");
      if (error) throw error;
      if (!riders || riders.length === 0) return [];

      const ids = riders.map((r) => r.profile_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

      const { data: activeDeliveries } = await supabase
        .from("deliveries")
        .select("assigned_rider_id")
        .in("status", ["assigned", "accepted", "in_transit"])
        .in("assigned_rider_id", ids);
      const countByRider = new Map<string, number>();
      (activeDeliveries ?? []).forEach((d) => {
        if (!d.assigned_rider_id) return;
        countByRider.set(d.assigned_rider_id, (countByRider.get(d.assigned_rider_id) ?? 0) + 1);
      });

      const withCounts: SuggestedRider[] = riders.map((r) => ({
        profile_id: r.profile_id,
        full_name: nameById.get(r.profile_id) ?? "Unknown",
        availability_status: r.availability_status,
        active_count: countByRider.get(r.profile_id) ?? 0,
      }));

      // Available first, then fewest active deliveries -- deterministic,
      // no scoring. Offline riders sort last but stay visible (owner
      // override is explicitly permitted, per Phase 2 §9).
      const statusRank = { available: 0, busy: 1, offline: 2 };
      return withCounts.sort((a, b) => {
        const rankDiff = statusRank[a.availability_status] - statusRank[b.availability_status];
        if (rankDiff !== 0) return rankDiff;
        return a.active_count - b.active_count;
      });
    },
  });
}

export function useAssignRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, riderId }: { deliveryId: string; riderId: string }) => {
      const { error } = await supabase.rpc("assign_rider", { p_delivery_id: deliveryId, p_rider_id: riderId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch_queue"] });
      queryClient.invalidateQueries({ queryKey: ["active_deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["suggested_riders"] });
    },
  });
}

export function usePendingReassignmentRequests() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["reassignment_requests", "pending", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reassignment_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useResolveReassignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, decision }: { requestId: string; decision: "approved" | "denied" }) => {
      const { error } = await supabase.rpc("resolve_reassignment", {
        p_request_id: requestId,
        p_decision: decision,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reassignment_requests"] });
      queryClient.invalidateQueries({ queryKey: ["dispatch_queue"] });
      queryClient.invalidateQueries({ queryKey: ["active_deliveries"] });
    },
  });
}
