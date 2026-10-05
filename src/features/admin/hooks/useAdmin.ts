import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";

export function useAllBusinesses() {
  return useQuery({
    queryKey: ["admin_businesses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetBusinessVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ businessId, status }: { businessId: string; status: "pending" | "verified" | "suspended" }) => {
      const { error } = await supabase.rpc("admin_set_business_verification", {
        p_business_id: businessId,
        p_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_businesses"] }),
  });
}

export function useAllRidersPlatformWide() {
  return useQuery({
    queryKey: ["admin_riders"],
    queryFn: async () => {
      const { data: riders, error } = await supabase.from("riders").select("profile_id, business_id, availability_status");
      if (error) throw error;
      if (!riders || riders.length === 0) return [];
      const ids = riders.map((r) => r.profile_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return riders.map((r) => ({ ...r, full_name: nameById.get(r.profile_id) ?? "Unknown" }));
    },
  });
}
