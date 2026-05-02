import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// DEV-ONLY: Simulate a blockchain deposit. Reuses the same atomic
// credit_deposit RPC the production webhook uses.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (Deno.env.get("ENVIRONMENT") === "production") {
      return new Response(JSON.stringify({ error: "Not available in production" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, amount, tx_hash } = await req.json();
    if (!user_id || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return new Response(JSON.stringify({ error: "Valid user_id and positive amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const depositAmount = Number(amount);
    const cryptoType = "USDT";
    // Caller may supply tx_hash to test idempotency; otherwise generate fresh.
    const txId = tx_hash || ("test_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24));

    const { data: result, error } = await serviceClient.rpc("credit_deposit", {
      p_user_id: user_id,
      p_crypto_type: cryptoType,
      p_amount: depositAmount,
      p_tx_hash: txId,
      p_network: "tron",
      p_idempotency_key: `deposit_${txId}`,
      p_simulated: true,
    });

    if (error) {
      console.error("Simulate deposit RPC error:", error);
      throw error;
    }

    console.log(`[TEST] Simulated deposit:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Simulate deposit error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
