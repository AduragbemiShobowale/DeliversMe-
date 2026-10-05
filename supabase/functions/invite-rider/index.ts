// supabase/functions/invite-rider/index.ts
//
// Phase 3: the one piece of the rider-invite flow that cannot be a plain
// RPC. Creating an auth.users row on someone else's behalf requires the
// service role key, which must never reach the client (Stage 16) -- so
// this runs server-side as a Supabase Edge Function instead.
//
// Flow:
//   1. Verify the caller is an authenticated Owner (using their own JWT,
//      via the anon-key client -- this respects RLS, so it can't be
//      spoofed by claiming a business_id that isn't really theirs).
//   2. Use the SERVICE ROLE client (bypasses RLS, intentionally, since
//      this is the one legitimate server-side privilege-escalation point
//      in the whole system) to invite the new auth user and then insert
//      their profiles + riders rows directly -- the same manual
//      provisioning this project's rider role has always required (see
//      0018's comment: "riders do not self-register").
//
// Deploy with: supabase functions deploy invite-rider
// Requires these secrets set on the project (Project Settings -> Edge
// Functions, or `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (the first two are usually auto-injected; SERVICE_ROLE_KEY is not --
// set it explicitly and treat it as seriously as a database password.)
//   APP_URL -- e.g. https://your-deployed-app.com (or http://localhost:5173
//   for local testing) -- also add "<APP_URL>/invite" to Authentication ->
//   URL Configuration -> Redirect URLs in the dashboard, or the invite
//   email link will redirect to the wrong place.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, fullName, phone } = await req.json();
    if (!email || !fullName) {
      return jsonResponse({ error: "email and fullName are required" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    // Step 1: verify the caller is a real, authenticated Owner -- using
    // the ANON key + their own token, so this respects RLS exactly the
    // way a normal client request would. Never trust a client-supplied
    // business_id; derive it from the caller's own profile row.
    const supabaseUserClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    const { data: callerProfile, error: profileError } = await supabaseUserClient
      .from("profiles")
      .select("role, business_id")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile) {
      return jsonResponse({ error: "Could not load caller profile" }, 403);
    }
    if (callerProfile.role !== "owner" || !callerProfile.business_id) {
      return jsonResponse({ error: "Only an SME Owner may invite a rider" }, 403);
    }

    const businessId = callerProfile.business_id;

    // Step 2: service-role client -- bypasses RLS. This is the one
    // deliberate, narrow escalation point in the system (Phase 2 report
    // / Stage 15's original rider-invite note).
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { role: "rider" }, // handle_new_user() no-ops on this -- see 0018/0022
        // Must match a URL added to Authentication -> URL Configuration ->
        // Redirect URLs in the Supabase dashboard, or Supabase will
        // silently fall back to the project's default Site URL instead.
        redirectTo: `${Deno.env.get("APP_URL") ?? ""}/invite`,
      });

    if (inviteError || !inviteData.user) {
      return jsonResponse({ error: inviteError?.message ?? "Failed to invite user" }, 500);
    }

    const newRiderId = inviteData.user.id;

    const { error: profileInsertError } = await supabaseAdmin.from("profiles").insert({
      id: newRiderId,
      role: "rider",
      business_id: businessId,
      full_name: fullName,
      phone: phone ?? null,
    });

    if (profileInsertError) {
      // The auth user now exists without a profile -- surface this
      // clearly rather than silently leaving a half-provisioned account.
      // A real production version would clean up (delete the auth user)
      // on this path; flagged here as a known gap rather than papered
      // over, since it's a genuine edge case worth a deliberate decision
      // rather than a silent implementation choice.
      return jsonResponse(
        { error: `Invited, but profile creation failed: ${profileInsertError.message}. This account needs manual cleanup.` },
        500
      );
    }

    const { error: riderInsertError } = await supabaseAdmin.from("riders").insert({
      profile_id: newRiderId,
      business_id: businessId,
      availability_status: "offline",
    });

    if (riderInsertError) {
      return jsonResponse(
        { error: `Profile created, but rider record failed: ${riderInsertError.message}. This account needs manual cleanup.` },
        500
      );
    }

    return jsonResponse({ success: true, riderId: newRiderId }, 200);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
