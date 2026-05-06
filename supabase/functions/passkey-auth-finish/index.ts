import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { verifyAuthenticationResponse } from "https://esm.sh/@simplewebauthn/server@13.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function rpFromOrigin(origin: string | null): { rpID: string; origin: string } {
  const o = origin || "https://peerlyp2p.lovable.app";
  const url = new URL(o);
  return { rpID: url.hostname, origin: o };
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { response, email, purpose } = await req.json();
    const _purpose = purpose === "step_up" ? "step_up" : "authentication";
    if (!response?.id) {
      return new Response(JSON.stringify({ error: "Missing response" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: pk } = await admin
      .from("passkeys")
      .select("*")
      .eq("credential_id", response.id)
      .maybeSingle();

    if (!pk) {
      return new Response(JSON.stringify({ error: "Unknown credential" }), { status: 400, headers: corsHeaders });
    }

    const { data: chal } = await admin
      .from("webauthn_challenges")
      .select("*")
      .eq("user_id", pk.user_id)
      .eq("purpose", _purpose)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!chal) {
      return new Response(JSON.stringify({ error: "Challenge expired" }), { status: 400, headers: corsHeaders });
    }

    const { rpID, origin } = rpFromOrigin(req.headers.get("Origin"));

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: chal.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: pk.credential_id,
        publicKey: b64ToBytes(pk.public_key),
        counter: Number(pk.counter),
        transports: pk.transports,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers: corsHeaders });
    }

    const newCounter = (verification.authenticationInfo as any).newCounter ?? Number(pk.counter);
    if (newCounter < Number(pk.counter)) {
      return new Response(JSON.stringify({ error: "Counter regression detected" }), { status: 400, headers: corsHeaders });
    }

    await admin
      .from("passkeys")
      .update({ counter: newCounter, last_used_at: new Date().toISOString() })
      .eq("id", pk.id);

    await admin.from("webauthn_challenges").delete().eq("id", chal.id);

    // Best-effort security event log
    await admin.from("security_events" as any).insert({
      user_id: pk.user_id,
      action_type: _purpose === "step_up" ? "passkey_step_up" : "passkey_login",
      status: "success",
      method: "passkey",
      metadata: { credential_id: pk.credential_id },
    }).then(() => {}, () => {});

    return new Response(JSON.stringify({ verified: true, userId: pk.user_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auth-finish error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
