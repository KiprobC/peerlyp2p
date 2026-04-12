import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// DEV-ONLY: Simulate a blockchain deposit for testing
// Reuses the same logic as tatum-webhook

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
    // Block in production
    const isProduction = Deno.env.get("ENVIRONMENT") === "production";
    if (isProduction) {
      return new Response(JSON.stringify({ error: "Not available in production" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate auth - admin only
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

    // Verify caller is admin
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

    const { user_id, amount } = await req.json();

    if (!user_id || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return new Response(JSON.stringify({ error: "Valid user_id and positive amount required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const depositAmount = Number(amount);
    const cryptoType = "USDT";
    const txId = "test_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

    // --- Reuse tatum-webhook logic below ---

    // Get or create user wallet
    const { data: wallet, error: walletError } = await serviceClient
      .rpc("get_or_create_wallet", { p_user_id: user_id, p_crypto_type: cryptoType });

    if (walletError) {
      console.error("Wallet error:", walletError);
      throw walletError;
    }

    const walletId = Array.isArray(wallet) ? wallet[0]?.id : wallet?.id ?? wallet;
    if (!walletId) {
      throw new Error("Failed to get wallet ID");
    }

    // Fetch current wallet balance for atomic update
    const { data: walletData, error: fetchError } = await serviceClient
      .from("wallets")
      .select("balance")
      .eq("id", walletId)
      .single();

    if (fetchError) throw fetchError;

    // Insert transaction (tx_hash unique constraint prevents duplicates)
    const { error: txError } = await serviceClient
      .from("wallet_transactions")
      .insert({
        wallet_id: walletId,
        user_id: user_id,
        type: "deposit",
        amount: depositAmount,
        fee: 0,
        crypto_type: cryptoType,
        status: "confirmed",
        tx_hash: txId,
        network: "tron",
        confirmations: 1,
        description: `[TEST] Simulated ${cryptoType} deposit`,
      });

    if (txError) {
      if (txError.code === "23505") {
        return new Response(JSON.stringify({ status: "duplicate", tx_hash: txId }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw txError;
    }

    // Credit user wallet balance
    const currentBalance = walletData?.balance ? Number(walletData.balance) : 0;
    const { error: updateError } = await serviceClient
      .from("wallets")
      .update({
        balance: currentBalance + depositAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", walletId);

    if (updateError) {
      console.error("Wallet update error:", updateError);
      throw updateError;
    }

    // Create notification
    await serviceClient
      .from("notifications")
      .insert({
        user_id: user_id,
        title: "Deposit Received",
        message: `${depositAmount} ${cryptoType} has been credited to your wallet.`,
        type: "payment",
        data: { tx_hash: txId, amount: depositAmount, crypto_type: cryptoType, simulated: true },
      });

    console.log(`[TEST] Simulated deposit: ${depositAmount} ${cryptoType} for user ${user_id}`);

    return new Response(JSON.stringify({
      status: "processed",
      tx_hash: txId,
      amount: depositAmount,
      crypto_type: cryptoType,
    }), {
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
