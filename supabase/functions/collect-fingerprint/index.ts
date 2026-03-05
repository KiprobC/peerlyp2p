import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for writes
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { device_type, browser, operating_system, screen_resolution, timezone, action_type } = body;

    // Get IP from headers
    const ip_address =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Generate device hash
    const encoder = new TextEncoder();
    const data = encoder.encode(`${ip_address}|${browser}|${operating_system}|${device_type}|${screen_resolution}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const device_hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Store fingerprint
    await adminClient.from("user_fingerprints").insert({
      user_id: user.id,
      ip_address,
      device_type,
      browser,
      operating_system,
      screen_resolution,
      timezone,
      device_hash,
      action_type: action_type || "login",
    });

    // Check for matching device_hash across different users
    const { data: matches } = await adminClient
      .from("user_fingerprints")
      .select("user_id")
      .eq("device_hash", device_hash)
      .neq("user_id", user.id)
      .limit(5);

    const uniqueMatchedUsers = [...new Set(matches?.map((m) => m.user_id) || [])];

    if (uniqueMatchedUsers.length > 0) {
      // Check if alert already exists
      const { data: existing } = await adminClient
        .from("user_risk_alerts")
        .select("id")
        .eq("user_id", user.id)
        .eq("risk_type", "shared_device")
        .eq("is_resolved", false)
        .maybeSingle();

      if (!existing) {
        await adminClient.from("user_risk_alerts").insert({
          user_id: user.id,
          risk_type: "shared_device",
          description: `Device fingerprint shared with ${uniqueMatchedUsers.length} other account(s)`,
          severity: uniqueMatchedUsers.length >= 3 ? "critical" : "high",
        });
      }

      // Also flag matched users
      for (const matchedUserId of uniqueMatchedUsers) {
        const { data: existingMatch } = await adminClient
          .from("user_risk_alerts")
          .select("id")
          .eq("user_id", matchedUserId)
          .eq("risk_type", "shared_device")
          .eq("is_resolved", false)
          .maybeSingle();

        if (!existingMatch) {
          await adminClient.from("user_risk_alerts").insert({
            user_id: matchedUserId,
            risk_type: "shared_device",
            description: `Device fingerprint shared with other account(s)`,
            severity: "high",
          });
        }
      }
    }

    // Check for shared IP across different users (within last 7 days)
    const { data: ipMatches } = await adminClient
      .from("user_fingerprints")
      .select("user_id")
      .eq("ip_address", ip_address)
      .neq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(10);

    const uniqueIpUsers = [...new Set(ipMatches?.map((m) => m.user_id) || [])];

    if (uniqueIpUsers.length >= 2) {
      const { data: existingIp } = await adminClient
        .from("user_risk_alerts")
        .select("id")
        .eq("user_id", user.id)
        .eq("risk_type", "shared_ip")
        .eq("is_resolved", false)
        .maybeSingle();

      if (!existingIp) {
        await adminClient.from("user_risk_alerts").insert({
          user_id: user.id,
          risk_type: "shared_ip",
          description: `IP address shared with ${uniqueIpUsers.length} other account(s) in the last 7 days`,
          severity: "medium",
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fingerprint collection error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
