import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const TATUM_API_URL = "https://api.tatum.io/v3";

const NETWORK_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum", 
  USDT: "tron",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Parse & validate input
    const { crypto_type } = await req.json();
    const normalizedCrypto = (crypto_type || "").toUpperCase().trim();

    if (!["BTC", "ETH", "USDT"].includes(normalizedCrypto)) {
      return new Response(
        JSON.stringify({ error: "Invalid crypto_type. Must be BTC, ETH, or USDT." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if address already exists
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing } = await serviceClient
      .from("deposit_addresses")
      .select("address")
      .eq("user_id", userId)
      .eq("crypto_type", normalizedCrypto)
      .eq("is_active", true)
      .maybeSingle();

    if (existing?.address) {
      return new Response(JSON.stringify({ address: existing.address }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate address via Tatum
    const tatumKey = Deno.env.get("TATUM_API_KEY");
    if (!tatumKey) {
      return new Response(JSON.stringify({ error: "Tatum API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let address: string;
    const network = NETWORK_MAP[normalizedCrypto];

    if (normalizedCrypto === "BTC") {
      // Generate BTC wallet & address
      const walletRes = await fetch(`${TATUM_API_URL}/bitcoin/wallet`, {
        method: "GET",
        headers: { "x-api-key": tatumKey },
      });
      if (!walletRes.ok) {
        const errBody = await walletRes.text();
        throw new Error(`Tatum BTC wallet generation failed [${walletRes.status}]: ${errBody}`);
      }
      const wallet = await walletRes.json();

      const addrRes = await fetch(`${TATUM_API_URL}/bitcoin/address/${wallet.xpub}/0`, {
        method: "GET",
        headers: { "x-api-key": tatumKey },
      });
      if (!addrRes.ok) {
        const errBody = await addrRes.text();
        throw new Error(`Tatum BTC address generation failed [${addrRes.status}]: ${errBody}`);
      }
      const addrData = await addrRes.json();
      address = addrData.address;

    } else if (normalizedCrypto === "ETH") {
      // Generate ETH wallet & address
      const walletRes = await fetch(`${TATUM_API_URL}/ethereum/wallet`, {
        method: "GET",
        headers: { "x-api-key": tatumKey },
      });
      if (!walletRes.ok) {
        const errBody = await walletRes.text();
        throw new Error(`Tatum ETH wallet generation failed [${walletRes.status}]: ${errBody}`);
      }
      const wallet = await walletRes.json();

      const addrRes = await fetch(`${TATUM_API_URL}/ethereum/address/${wallet.xpub}/0`, {
        method: "GET",
        headers: { "x-api-key": tatumKey },
      });
      if (!addrRes.ok) {
        const errBody = await addrRes.text();
        throw new Error(`Tatum ETH address generation failed [${addrRes.status}]: ${errBody}`);
      }
      const addrData = await addrRes.json();
      address = addrData.address;

    } else {
      // USDT on Tron - generate Tron wallet & address
      const walletRes = await fetch(`${TATUM_API_URL}/tron/wallet`, {
        method: "GET",
        headers: { "x-api-key": tatumKey },
      });
      if (!walletRes.ok) {
        const errBody = await walletRes.text();
        throw new Error(`Tatum TRON wallet generation failed [${walletRes.status}]: ${errBody}`);
      }
      const wallet = await walletRes.json();

      const addrRes = await fetch(`${TATUM_API_URL}/tron/address/${wallet.xpub}/0`, {
        method: "GET",
        headers: { "x-api-key": tatumKey },
      });
      if (!addrRes.ok) {
        const errBody = await addrRes.text();
        throw new Error(`Tatum TRON address generation failed [${addrRes.status}]: ${errBody}`);
      }
      const addrData = await addrRes.json();
      address = addrData.address;
    }

    // Store in database
    const { error: insertError } = await serviceClient
      .from("deposit_addresses")
      .insert({
        user_id: userId,
        crypto_type: normalizedCrypto,
        address,
        network,
        is_active: true,
        metadata: { source: "tatum" },
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      // If duplicate, fetch existing
      if (insertError.code === "23505") {
        const { data: refetch } = await serviceClient
          .from("deposit_addresses")
          .select("address")
          .eq("user_id", userId)
          .eq("crypto_type", normalizedCrypto)
          .eq("is_active", true)
          .maybeSingle();
        return new Response(JSON.stringify({ address: refetch?.address }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    return new Response(JSON.stringify({ address }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating address:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
