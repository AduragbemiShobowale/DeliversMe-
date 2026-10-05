import { useMutation } from "@tanstack/react-query";
import { supabase } from "../../../shared/lib/supabase";

interface SignInInput {
  email: string;
  password: string;
}

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: SignInInput) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
  });
}

interface SignUpOwnerInput {
  email: string;
  password: string;
  fullName: string;
  businessName: string;
  phone?: string;
}

export function useSignUpOwner() {
  return useMutation({
    mutationFn: async ({ email, password, fullName, businessName, phone }: SignUpOwnerInput) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: "owner", full_name: fullName, business_name: businessName, phone: phone ?? null } },
      });
      if (error) throw error;
      return data;
    },
  });
}

interface SignUpCustomerInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

/**
 * Customer self-registration (Phase 2's corrected role model). After a
 * session exists, claim_pending_relationships_by_phone (0024) is called
 * separately -- see AuthProvider -- so any pending business_customers
 * rows matching this phone become visible immediately.
 */
export function useSignUpCustomer() {
  return useMutation({
    mutationFn: async ({ email, password, fullName, phone }: SignUpCustomerInput) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: "customer", full_name: fullName, phone } },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  });
}
