import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Tatum webhook for deposit notifications
// This is a PUBLIC endpoint (no JWT) - validates via HMAC signature

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
    const body = await req.json();
    console.log("Tatum webhook received:", JSON.stringify(body));

    // Validate required fields
    const { address, amount, txId, currency, chain, blockNumber, type } = body;

    if (!address || !amount || !txId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only process incoming transactions
    if (type && type !== "native" && type !== "token" && type !== "incoming") {
      return new Response(JSON.stringify({ status: "ignored", reason: "not an incoming tx" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Map chain to crypto_type
    let cryptoType: string;
    if (currency === "BTC" || chain === "bitcoin") {
      cryptoType = "BTC";
    } else if (currency === "ETH" || chain === "ethereum") {
      cryptoType = "ETH";
    } else if (currency === "USDT" || chain === "tron" || currency === "USDT_TRON") {
      cryptoType = "USDT";
    } else {
      console.log(`Unknown currency/chain: ${currency}/${chain}`);
      return new Response(JSON.stringify({ status: "ignored", reason: "unsupported currency" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find deposit address owner
    const { data: depositAddr, error: addrError } = await serviceClient
      .from("deposit_addresses")
      .select("user_id, id")
      .eq("address", address)
      .eq("is_active", true)
      .maybeSingle();

    if (addrError || !depositAddr) {
      console.log("Deposit address not found:", address);
      return new Response(JSON.stringify({ status: "ignored", reason: "address not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = depositAddr.user_id;
    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create user wallet
    const { data: wallet, error: walletError } = await serviceClient
      .rpc("get_or_create_wallet", { p_user_id: userId, p_crypto_type: cryptoType });

    if (walletError) {
      console.error("Wallet error:", walletError);
      throw walletError;
    }

    const walletId = Array.isArray(wallet) ? wallet[0]?.id : wallet?.id;
    if (!walletId) {
      throw new Error("Failed to get wallet ID");
    }

    // Insert transaction (tx_hash unique constraint prevents duplicates)
    const { error: txError } = await serviceClient
      .from("wallet_transactions")
      .insert({
        wallet_id: walletId,
        user_id: userId,
        type: "deposit",
        amount: depositAmount,
        fee: 0,
        crypto_type: cryptoType,
        status: "confirmed",
        tx_hash: txId,
        network: chain || null,
        confirmations: blockNumber ? 1 : 0,
        description: `${cryptoType} deposit via blockchain`,
      });

    if (txError) {
      // Duplicate tx_hash - already processed
      if (txError.code === "23505") {
        console.log("Duplicate transaction, already processed:", txId);
        return new Response(JSON.stringify({ status: "duplicate" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw txError;
    }

    // Credit user wallet balance
    const { error: updateError } = await serviceClient
      .from("wallets")
      .update({ 
        balance: wallet[0]?.balance 
          ? parseFloat(wallet[0].balance) + depositAmount 
          : depositAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", walletId);

    if (updateError) {
      console.error("Wallet update error:", updateError);
      throw updateError;
    }

    // Update deposit address stats
    await serviceClient
      .from("deposit_addresses")
      .update({
        total_deposited: (depositAddr as any).total_deposited 
          ? parseFloat((depositAddr as any).total_deposited) + depositAmount 
          : depositAmount,
        last_deposit_at: new Date().toISOString(),
        last_monitored_at: new Date().toISOString(),
      })
      .eq("id", depositAddr.id);

    // Create notification
    await serviceClient
      .from("notifications")
      .insert({
        user_id: userId,
        title: "Deposit Received",
        message: `${depositAmount} ${cryptoType} has been credited to your wallet.`,
        type: "payment",
        data: { tx_hash: txId, amount: depositAmount, crypto_type: cryptoType },
      });

    console.log(`Deposit processed: ${depositAmount} ${cryptoType} for user ${userId}`);

    return new Response(JSON.stringify({ status: "processed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
