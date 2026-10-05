import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";
import { useAuth } from "../../../app/AuthProvider";

export function useMyBusiness() {
  const { businessId } = useAuth();
  return useQuery({
    queryKey: ["business", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", businessId!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateBusinessSettings() {
  const { businessId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: { name: string; assignment_timeout_minutes: number }) => {
      const { error } = await supabase.from("businesses").update(values).eq("id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business", businessId] }),
  });
}
