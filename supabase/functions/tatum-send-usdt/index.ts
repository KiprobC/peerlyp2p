import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// USDT TRC20 contract address on Tron mainnet
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TATUM_API_URL = "https://api.tatum.io/v3";

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
    // Auth check - only authenticated users can trigger this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse and validate input
    const { trade_id } = await req.json();

    if (!trade_id || typeof trade_id !== "string") {
      return new Response(JSON.stringify({ error: "trade_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: prefer client-supplied Idempotency-Key header; fall back to
    // a deterministic key so missing header still cannot double-spend a trade.
    const idemHeader = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
    const idemKey = (idemHeader && idemHeader.trim().length > 0)
      ? `send_usdt:${trade_id}:${idemHeader.trim()}`
      : `send_usdt:${trade_id}`;

    const claim = await serviceClient.rpc("claim_idempotency_key", {
      p_key: idemKey,
      p_scope: "tatum_send_usdt",
      p_reference_id: trade_id,
      p_actor_id: user.id,
    });
    if (claim.error) {
      console.error("claim_idempotency_key error", claim.error);
      return new Response(JSON.stringify({ error: "Idempotency check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const claimData = claim.data as any;
    if (claimData?.replay) {
      return new Response(JSON.stringify({ ...(claimData.response ?? {}), replay: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (claimData?.in_progress) {
      return new Response(JSON.stringify({ error: "Withdrawal already in progress", in_progress: true }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper to settle the idempotency key around any exit branch.
    const settle = async (ok: boolean, payload: Record<string, unknown>) => {
      try {
        if (ok) {
          await serviceClient.rpc("complete_idempotency_key", { p_key: idemKey, p_response: payload });
        } else {
          await serviceClient.rpc("fail_idempotency_key", { p_key: idemKey, p_error: String(payload.error ?? "failed") });
        }
      } catch (e) {
        console.error("settle idempotency error", e);
      }
    };

    // Fetch the trade
    const { data: trade, error: tradeError } = await serviceClient
      .from("trades")
      .select("*")
      .eq("id", trade_id)
      .single();

    if (tradeError || !trade) {
      await settle(false, { error: "Trade not found" });
      return new Response(JSON.stringify({ error: "Trade not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security: only the seller can trigger release
    if (trade.seller_id !== user.id) {
      const { data: adminRole } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        await settle(false, { error: "Forbidden" });
        return new Response(JSON.stringify({ error: "Only the seller or admin can release escrow" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (trade.status !== "payment_sent" && trade.status !== "disputed") {
      await settle(false, { error: `bad status: ${trade.status}` });
      return new Response(JSON.stringify({ error: `Cannot release escrow for trade with status: ${trade.status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (trade.escrow_released) {
      const payload = { success: true, message: "Escrow already released", already_released: true };
      await settle(true, payload);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cryptoType = (trade.crypto_type || "").toUpperCase().trim();

    if (cryptoType !== "USDT") {
      const payload = { success: true, message: "Non-USDT trade - internal release only", on_chain: false };
      await settle(true, payload);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: buyerAddr, error: addrError } = await serviceClient
      .from("deposit_addresses")
      .select("address")
      .eq("user_id", trade.buyer_id)
      .eq("crypto_type", "USDT")
      .eq("is_active", true)
      .maybeSingle();

    if (addrError || !buyerAddr?.address) {
      console.error("Buyer deposit address not found:", addrError);
      await settle(false, { error: "Buyer deposit address missing" });
      return new Response(JSON.stringify({
        error: "Buyer's USDT deposit address not found. Buyer must generate a deposit address first."
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tatumKey = Deno.env.get("TATUM_API_KEY");
    const masterPrivateKey = Deno.env.get("TATUM_MASTER_WALLET_PRIVATE_KEY");
    const masterAddress = Deno.env.get("TATUM_MASTER_WALLET_ADDRESS");

    if (!tatumKey || !masterPrivateKey || !masterAddress) {
      console.error("Missing Tatum configuration");
      await settle(false, { error: "Tatum config missing" });
      return new Response(JSON.stringify({ error: "Blockchain transfer configuration incomplete" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Calculate the net amount (after 0.99% fee, matching release_escrow_with_fee logic)
    const feeRate = 0.0099;
    const feeAmount = Math.round(trade.crypto_amount * feeRate * 1e6) / 1e6;
    const buyerAmount = Math.round((trade.crypto_amount - feeAmount) * 1e6) / 1e6;

    console.log(`Sending ${buyerAmount} USDT TRC20 to ${buyerAddr.address} for trade ${trade_id}`);

    // Send USDT TRC20 via Tatum API
    const sendResponse = await fetch(`${TATUM_API_URL}/tron/trc20/transaction`, {
      method: "POST",
      headers: {
        "x-api-key": tatumKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fromPrivateKey: masterPrivateKey,
        to: buyerAddr.address,
        tokenAddress: USDT_TRC20_CONTRACT,
        feeLimit: 100, // TRX fee limit (in TRX)
        amount: buyerAmount.toString(),
      }),
    });

    const sendResult = await sendResponse.json();

    if (!sendResponse.ok) {
      console.error("Tatum send failed:", JSON.stringify(sendResult));
      return new Response(JSON.stringify({ 
        error: "Blockchain transfer failed", 
        details: sendResult.message || sendResult.statusCode || "Unknown error" 
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txHash = sendResult.txId;
    console.log(`USDT TRC20 transfer successful. TX: ${txHash}`);

    // Log the on-chain transaction in wallet_transactions
    const { data: buyerWallet } = await serviceClient
      .rpc("get_or_create_wallet", { p_user_id: trade.buyer_id, p_crypto_type: "USDT" });

    const buyerWalletId = Array.isArray(buyerWallet) ? buyerWallet[0] : buyerWallet;

    if (buyerWalletId) {
      await serviceClient
        .from("wallet_transactions")
        .insert({
          wallet_id: typeof buyerWalletId === "string" ? buyerWalletId : buyerWalletId,
          user_id: trade.buyer_id,
          type: "trade",
          amount: buyerAmount,
          fee: 0,
          crypto_type: "USDT",
          status: "confirmed",
          tx_hash: txHash,
          network: "tron",
          trade_id: trade_id,
          description: `USDT escrow release for trade (on-chain)`,
        });
    }

    // Create notification for buyer
    await serviceClient
      .from("notifications")
      .insert({
        user_id: trade.buyer_id,
        title: "Crypto Released",
        message: `${buyerAmount} USDT has been sent to your wallet on-chain.`,
        type: "payment",
        data: { 
          trade_id, 
          tx_hash: txHash, 
          amount: buyerAmount, 
          crypto_type: "USDT" 
        },
      });

    return new Response(JSON.stringify({ 
      success: true, 
      tx_hash: txHash,
      buyer_amount: buyerAmount,
      fee_amount: feeAmount,
      on_chain: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Send USDT error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
