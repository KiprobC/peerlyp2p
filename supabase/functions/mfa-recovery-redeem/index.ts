import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Not authenticated" }, 401);
    }

    // Validate the caller's (AAL1) session.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) return json({ error: "Recovery code is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate + consume. The RPC invalidates the remaining set and turns 2FA off.
    const { data: redeemed, error: redeemError } = await admin.rpc("redeem_recovery_code", {
      p_user_id: userId,
      p_code: code,
    });

    if (redeemError) {
      console.error("redeem_recovery_code failed", redeemError.message);
      return json({ error: "Unable to process recovery code" }, 500);
    }

    if (!redeemed) {
      // Never log the submitted value.
      console.warn("Invalid recovery code attempt", { userId });
      return json({ error: "Invalid or already-used recovery code" }, 400);
    }

    // Remove every enrolled authenticator so the user must set up a new one.
    try {
      const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId });
      for (const factor of factors?.factors ?? []) {
        await admin.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
      }
    } catch (e) {
      console.error("factor cleanup failed", e instanceof Error ? e.message : e);
    }

    // Best-effort audit + notification.
    try {
      await admin.from("notifications").insert({
        user_id: userId,
        type: "system",
        title: "Two-factor authentication reset",
        message:
          "A recovery code was used to reset two-factor authentication. All remaining recovery codes were invalidated. Set up a new authenticator now.",
      });
    } catch (_) {
      /* notifications are non-critical */
    }

    return json({ success: true });
  } catch (e) {
    console.error("mfa-recovery-redeem error", e instanceof Error ? e.message : e);
    return json({ error: "Unexpected error" }, 500);
  }
});
