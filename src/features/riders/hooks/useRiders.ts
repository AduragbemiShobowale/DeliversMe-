import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";
import { useAuth } from "../../../app/AuthProvider";

export interface RiderListItem {
  profile_id: string;
  full_name: string;
  phone: string | null;
  availability_status: "available" | "busy" | "offline";
}

export function useRiders() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["riders", session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<RiderListItem[]> => {
      // Two plain queries rather than a PostgREST embedded join --
      // our hand-maintained Database type (Phase 2) doesn't carry the
      // Relationships metadata `supabase gen types` would normally
      // generate, which embedded-select typing depends on. Simpler and
      // equally correct to merge client-side; RLS (Stage 16) already
      // scopes both queries to the caller's own business regardless.
      const { data: riders, error: ridersError } = await supabase
        .from("riders")
        .select("profile_id, availability_status");
      if (ridersError) throw ridersError;
      if (!riders || riders.length === 0) return [];

      const ids = riders.map((r) => r.profile_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      if (profilesError) throw profilesError;

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

      return riders.map((r) => ({
        profile_id: r.profile_id,
        availability_status: r.availability_status,
        full_name: profileById.get(r.profile_id)?.full_name ?? "Unknown",
        phone: profileById.get(r.profile_id)?.phone ?? null,
      }));
    },
  });
}

interface InviteRiderInput {
  email: string;
  fullName: string;
  phone?: string;
}

export function useInviteRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteRiderInput) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Not signed in");

      const { data, error } = await supabase.functions.invoke("invite-rider", {
        body: input,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["riders"] });
    },
  });
}
