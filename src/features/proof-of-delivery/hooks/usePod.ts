import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";

/** Latest (highest-version) proof of delivery for a delivery -- versioning per Phase 2 §11. */
export function useLatestPod(deliveryId: string | undefined) {
  return useQuery({
    queryKey: ["pod", deliveryId],
    enabled: !!deliveryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proof_of_delivery")
        .select("*")
        .eq("delivery_id", deliveryId!)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Generates a fresh signed URL for a stored POD path -- photo_url in the
 * table is a permanent storage path, not a URL (see PhotoCapture's comment). */
export function usePodSignedUrl(path: string | undefined) {
  return useQuery({
    queryKey: ["pod_signed_url", path],
    enabled: !!path,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("proof-of-delivery").createSignedUrl(path!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
