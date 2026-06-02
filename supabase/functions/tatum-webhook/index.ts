import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Tatum webhook for deposit notifications
// PUBLIC endpoint (no JWT). Idempotency is enforced server-side via tx_hash.

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
    // Read the raw body so we can verify the HMAC signature before parsing.
    const rawBody = await req.text();

    // Verify Tatum webhook signature (HMAC-SHA256 of raw body using TATUM_WEBHOOK_SECRET).
    // Fail closed: without a configured secret, reject all webhook calls.
    const webhookSecret = Deno.env.get("TATUM_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("TATUM_WEBHOOK_SECRET is not configured; rejecting webhook.");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providedSig =
      req.headers.get("x-payload-hash") ||
      req.headers.get("x-signature") ||
      req.headers.get("x-tatum-signature") ||
      "";

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const sigBytes = new Uint8Array(sigBuf);
    const expectedHex = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expectedBase64 = btoa(String.fromCharCode(...sigBytes));

    const normalizedProvided = providedSig.trim().replace(/^sha256=/i, "");
    const signatureValid =
      normalizedProvided.length > 0 &&
      (normalizedProvided.toLowerCase() === expectedHex ||
        normalizedProvided === expectedBase64);

    if (!signatureValid) {
      console.warn("Tatum webhook signature mismatch");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = JSON.parse(rawBody);
    console.log("Tatum webhook received:", JSON.stringify(body));

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Replay protection: hash full body, dedup via webhook_events table.
    // Also reject events older than 10 minutes if a timestamp is present.
    let sourceTs: string | null = null;
    const tsCandidate =
      body?.timestamp ?? body?.eventTime ?? body?.blockTime ?? body?.created;
    if (tsCandidate) {
      const n = typeof tsCandidate === "number" ? tsCandidate : Number(tsCandidate);
      if (Number.isFinite(n)) {
        sourceTs = new Date(n < 1e12 ? n * 1000 : n).toISOString();
      } else if (typeof tsCandidate === "string") {
        const d = new Date(tsCandidate);
        if (!isNaN(d.getTime())) sourceTs = d.toISOString();
      }
    }

    const { data: recordResult, error: recordErr } = await serviceClient.rpc(
      "record_webhook_event",
      {
        p_provider: "tatum",
        p_payload_hash: expectedHex,
        p_signature: normalizedProvided,
        p_source_ts: sourceTs,
        p_payload: body,
        p_max_age_seconds: 600,
      },
    );
    if (recordErr) {
      console.error("record_webhook_event error", recordErr);
      return new Response(JSON.stringify({ error: "Replay check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (recordResult && (recordResult as any).accepted === false) {
      console.warn("Webhook rejected:", recordResult);
      return new Response(JSON.stringify({ status: "rejected", reason: (recordResult as any).reason }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { address, amount, txId, currency, chain, type } = body;


    if (!address || !amount || !txId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    if (currency === "BTC" || chain === "bitcoin") cryptoType = "BTC";
    else if (currency === "ETH" || chain === "ethereum") cryptoType = "ETH";
    else if (currency === "USDT" || chain === "tron" || currency === "USDT_TRON") cryptoType = "USDT";
    else {
      console.log(`Unknown currency/chain: ${currency}/${chain}`);
      return new Response(JSON.stringify({ status: "ignored", reason: "unsupported currency" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: depositAddr } = await serviceClient
      .from("deposit_addresses")
      .select("user_id, id, total_deposited")
      .eq("address", address)
      .eq("is_active", true)
      .maybeSingle();

    if (!depositAddr) {
      console.log("Deposit address not found:", address);
      return new Response(JSON.stringify({ status: "ignored", reason: "address not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single atomic, idempotent credit (handles wallet creation, locking,
    // dedup via idempotency_keys + tx_hash unique constraint, notification).
    const { data: result, error: creditError } = await serviceClient.rpc("credit_deposit", {
      p_user_id: depositAddr.user_id,
      p_crypto_type: cryptoType,
      p_amount: depositAmount,
      p_tx_hash: txId,
      p_network: chain || null,
      p_idempotency_key: `deposit_${txId}`,
      p_simulated: false,
    });

    if (creditError) {
      console.error("credit_deposit error:", creditError);
      throw creditError;
    }

    // Best-effort deposit-address stats update (non-critical)
    await serviceClient
      .from("deposit_addresses")
      .update({
        total_deposited: (Number((depositAddr as any).total_deposited) || 0) + depositAmount,
        last_deposit_at: new Date().toISOString(),
        last_monitored_at: new Date().toISOString(),
      })
      .eq("id", depositAddr.id);

    console.log(`Deposit processed:`, result);
    return new Response(JSON.stringify({ status: "processed", result }), {
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
