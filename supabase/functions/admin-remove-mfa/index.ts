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
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Not authenticated" }, 401);
    const actorId = userData.user.id;

    // Only admins may strip another account's second factor.
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: actorId,
      _role: "admin",
    });
    if (isAdmin !== true) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetUserId = typeof body.target_user_id === "string" ? body.target_user_id.trim() : "";
    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : null;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) return json({ error: "A valid user is required" }, 400);
    if (reason.length < 5) return json({ error: "A detailed reason is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let removed = 0;
    const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({
      userId: targetUserId,
    });
    if (listError) {
      console.error("listFactors failed", listError.message);
      return json({ error: "Could not read the user's authenticators" }, 500);
    }
    for (const factor of factors?.factors ?? []) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ userId: targetUserId, id: factor.id });
      if (!error) removed += 1;
    }

    // Audit + notify, attributed to the acting admin.
    const { error: auditError } = await userClient.rpc("admin_record_mfa_removal", {
      p_request_id: requestId,
      p_target_user: targetUserId,
      p_reason: reason,
      p_factors: removed,
    });
    if (auditError) {
      console.error("admin_record_mfa_removal failed", auditError.message);
      return json({ error: "Authenticators removed but the audit record failed" }, 500);
    }

    return json({ success: true, removed });
  } catch (e) {
    console.error("admin-remove-mfa error", e instanceof Error ? e.message : e);
    return json({ error: "Unexpected error" }, 500);
  }
});
