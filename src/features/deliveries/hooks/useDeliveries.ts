import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";
import { useAuth } from "../../../app/AuthProvider";
import type { DeliveryPriority, DeliveryStatus } from "../../../types/database";

export interface DeliveryListItem {
  id: string;
  status: DeliveryStatus;
  priority: DeliveryPriority;
  created_at: string;
  business_customer_id: string;
  customer_name: string;
}

async function attachCustomerNames<T extends { business_customer_id: string }>(
  rows: T[]
): Promise<(T & { customer_name: string })[]> {
  if (rows.length === 0) return [];
  const bcIds = [...new Set(rows.map((r) => r.business_customer_id))];
  const { data: bcs, error } = await supabase
    .from("business_customers")
    .select("id, pending_name, customer_profile_id")
    .in("id", bcIds);
  if (error) throw error;

  const claimedIds = (bcs ?? []).filter((b) => b.customer_profile_id).map((b) => b.customer_profile_id as string);
  let profileNames = new Map<string, string>();
  if (claimedIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", claimedIds);
    profileNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  }
  const nameByBcId = new Map(
    (bcs ?? []).map((b) => [
      b.id,
      (b.customer_profile_id && profileNames.get(b.customer_profile_id)) || b.pending_name || "Unknown",
    ])
  );

  return rows.map((r) => ({ ...r, customer_name: nameByBcId.get(r.business_customer_id) ?? "Unknown" }));
}

/** Ready-for-dispatch queue, deterministic ordering per Stage 9/11:
 * priority, then created_at, then id -- matches idx_deliveries_queue_order. */
export function useDispatchQueue() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["dispatch_queue", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<DeliveryListItem[]> => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, priority, created_at, business_customer_id")
        .eq("status", "ready_for_dispatch")
        .order("priority", { ascending: false }) // 'urgent' > 'normal' alphabetically works here since enum text sort; see note below
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return attachCustomerNames(data ?? []);
    },
  });
}

/** All deliveries not in ready_for_dispatch -- the "active + history" view. */
export function useActiveDeliveries() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["active_deliveries", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<DeliveryListItem[]> => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, priority, created_at, business_customer_id")
        .neq("status", "ready_for_dispatch")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return attachCustomerNames(data ?? []);
    },
  });
}

export function useDelivery(deliveryId: string | undefined) {
  return useQuery({
    queryKey: ["delivery", deliveryId],
    enabled: !!deliveryId,
    queryFn: async () => {
      const { data, error } = await supabase.from("deliveries").select("*").eq("id", deliveryId!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useDeliveryEvents(deliveryId: string | undefined) {
  return useQuery({
    queryKey: ["delivery", deliveryId, "events"],
    enabled: !!deliveryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_events")
        .select("*")
        .eq("delivery_id", deliveryId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface CreateDeliveryInput {
  businessCustomerId: string;
  priority: DeliveryPriority;
  scheduledWindowStart?: string;
  scheduledWindowEnd?: string;
}

export function useCreateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDeliveryInput) => {
      const { data, error } = await supabase.rpc("create_delivery", {
        p_business_customer_id: input.businessCustomerId,
        p_priority: input.priority,
        p_scheduled_window_start: input.scheduledWindowStart ?? null,
        p_scheduled_window_end: input.scheduledWindowEnd ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch_queue"] });
    },
  });
}

export function useRecordRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, rating, comment }: { deliveryId: string; rating: number; comment?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("deliveries")
        .update({ rating, rating_comment: comment ?? null, rating_recorded_by: userData.user?.id })
        .eq("id", deliveryId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["delivery", variables.deliveryId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_metrics"] });
    },
  });
}

/** Customer's own deliveries across every SME relationship -- RLS
 * (deliveries_select_customer, 0011) is what actually scopes this, not
 * any filter here; the query is intentionally unscoped by business. */
export function useMyDeliveriesAsCustomer() {
  return useQuery({
    queryKey: ["customer_deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, priority, created_at, business_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const businessIds = [...new Set(data.map((d) => d.business_id))];
      const { data: businesses } = await supabase.from("businesses").select("id, name").in("id", businessIds);
      const nameById = new Map((businesses ?? []).map((b) => [b.id, b.name]));

      return data.map((d) => ({ ...d, business_name: nameById.get(d.business_id) ?? "Unknown business" }));
    },
  });
}
