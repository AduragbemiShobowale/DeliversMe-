import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";
import { useAuth } from "../../../app/AuthProvider";

export interface BusinessCustomerListItem {
  id: string;
  status: "pending_invitation" | "active";
  full_name: string;
  phone: string | null;
  default_address: string | null;
}

export function useBusinessCustomers() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["business_customers", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<BusinessCustomerListItem[]> => {
      const { data, error } = await supabase
        .from("business_customers")
        .select("id, status, pending_name, pending_phone, default_address, customer_profile_id")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const claimedIds = (data ?? [])
        .filter((r) => r.customer_profile_id)
        .map((r) => r.customer_profile_id as string);

      let claimedProfiles = new Map<string, { full_name: string; phone: string | null }>();
      if (claimedIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", claimedIds);
        if (profilesError) throw profilesError;
        claimedProfiles = new Map((profiles ?? []).map((p) => [p.id, p]));
      }

      return (data ?? []).map((r) => {
        const claimed = r.customer_profile_id ? claimedProfiles.get(r.customer_profile_id) : undefined;
        return {
          id: r.id,
          status: r.status,
          full_name: claimed?.full_name ?? r.pending_name ?? "Unknown",
          phone: claimed?.phone ?? r.pending_phone,
          default_address: r.default_address,
        };
      });
    },
  });
}

interface AddCustomerInput {
  phone: string;
  email?: string;
  name: string;
  defaultAddress?: string;
}

export function useAddCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddCustomerInput) => {
      const { data, error } = await supabase.rpc("find_or_create_business_customer", {
        p_phone: input.phone,
        p_email: input.email ?? null,
        p_name: input.name,
        p_default_address: input.defaultAddress ?? null,
      });
      if (error) throw error;
      return data as string; // business_customer_id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_customers"] });
    },
  });
}
