import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at startup rather than producing confusing downstream
  // "fetch failed" errors from every query. Set these in .env.local —
  // see .env.example.
  throw new Error(
    "Missing Supabase environment variables. Copy .env.example to .env.local " +
      "and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

// Typed against the generated schema (Phase 2 produces the real
// src/types/database.ts via `supabase gen types typescript`).
// Never call this client with the service role key — the anon key here
// is what makes RLS the actual enforcement layer, per Stage 16.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
