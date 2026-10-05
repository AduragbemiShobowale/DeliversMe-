import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";
import { useAuth } from "../../../app/AuthProvider";
import type { DeliveryStatus } from "../../../types/database";

export interface RiderDelivery {
  id: string;
  status: DeliveryStatus;
  assigned_at: string | null;
  business_customer_id: string;
  reassignment_requested: boolean;
  customer_name: string;
  address: string | null;
}

async function withCustomerInfo(rows: any[]): Promise<RiderDelivery[]> {
  if (rows.length === 0) return [];
  const bcIds = [...new Set(rows.map((r) => r.business_customer_id))];
  const { data: bcs } = await supabase
    .from("business_customers")
    .select("id, pending_name, default_address, customer_profile_id")
    .in("id", bcIds);
  const claimedIds = (bcs ?? []).filter((b) => b.customer_profile_id).map((b) => b.customer_profile_id as string);
  let profileNames = new Map<string, string>();
  if (claimedIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", claimedIds);
    profileNames = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  }
  const infoByBc = new Map(
    (bcs ?? []).map((b) => [
      b.id,
      {
        name: (b.customer_profile_id && profileNames.get(b.customer_profile_id)) || b.pending_name || "Unknown",
        address: b.default_address,
      },
    ])
  );
  return rows.map((r) => ({
    ...r,
    customer_name: infoByBc.get(r.business_customer_id)?.name ?? "Unknown",
    address: infoByBc.get(r.business_customer_id)?.address ?? null,
  }));
}

/** A rider's single active job (offer, accepted, or in-transit) -- at most one, since a rider takes jobs sequentially per the approved dispatch model. */
export function useMyActiveJob() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["rider_active_job", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<RiderDelivery | null> => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, assigned_at, business_customer_id, reassignment_requested")
        .eq("assigned_rider_id", session!.user.id)
        .in("status", ["assigned", "accepted", "in_transit"])
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [withInfo] = await withCustomerInfo([data]);
      return withInfo;
    },
    refetchInterval: 15_000, // covers the gap between Realtime setup and a fresh assignment landing
  });
}

export function useRiderHistory() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["rider_history", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<RiderDelivery[]> => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("id, status, assigned_at, business_customer_id, reassignment_requested")
        .eq("assigned_rider_id", session!.user.id)
        .in("status", ["delivered", "failed"])
        .order("delivered_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return withCustomerInfo(data ?? []);
    },
  });
}

function useInvalidateJob() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["rider_active_job"] });
    queryClient.invalidateQueries({ queryKey: ["rider_history"] });
  };
}

export function useAcceptAssignment() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const { error } = await supabase.rpc("accept_delivery_assignment", { p_delivery_id: deliveryId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRejectAssignment() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const { error } = await supabase.rpc("reject_delivery_assignment", { p_delivery_id: deliveryId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useStartDelivery() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const { error } = await supabase.rpc("start_delivery", { p_delivery_id: deliveryId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useCompleteDelivery() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async ({
      deliveryId,
      photoUrl,
      recipientName,
      notes,
    }: {
      deliveryId: string;
      photoUrl: string;
      recipientName?: string;
      notes?: string;
    }) => {
      const { error } = await supabase.rpc("complete_delivery", {
        p_delivery_id: deliveryId,
        p_photo_url: photoUrl,
        p_recipient_name: recipientName ?? null,
        p_notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useFailDelivery() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async ({ deliveryId, reason }: { deliveryId: string; reason: string }) => {
      const { error } = await supabase.rpc("fail_delivery", { p_delivery_id: deliveryId, p_reason: reason });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRequestReassignment() {
  const invalidate = useInvalidateJob();
  return useMutation({
    mutationFn: async ({
      deliveryId,
      reason,
      evidencePhotoUrl,
    }: {
      deliveryId: string;
      reason: string;
      evidencePhotoUrl?: string;
    }) => {
      const { error } = await supabase.rpc("request_reassignment", {
        p_delivery_id: deliveryId,
        p_reason: reason,
        p_evidence_photo_url: evidencePhotoUrl ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
