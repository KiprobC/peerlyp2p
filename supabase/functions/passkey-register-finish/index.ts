import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { verifyRegistrationResponse } from "https://esm.sh/@simplewebauthn/server@13.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function rpFromOrigin(origin: string | null): { rpID: string; origin: string } {
  const o = origin || "https://peerlyp2p.lovable.app";
  const url = new URL(o);
  return { rpID: url.hostname, origin: o };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const { response, deviceName } = await req.json();
    if (!response) {
      return new Response(JSON.stringify({ error: "Missing response" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: chal } = await admin
      .from("webauthn_challenges")
      .select("*")
      .eq("user_id", userId)
      .eq("purpose", "registration")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!chal) {
      return new Response(JSON.stringify({ error: "Challenge expired" }), { status: 400, headers: corsHeaders });
    }

    const { rpID, origin } = rpFromOrigin(req.headers.get("Origin"));

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: chal.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return new Response(JSON.stringify({ error: "Verification failed" }), { status: 400, headers: corsHeaders });
    }

    const info: any = verification.registrationInfo;
    const credential = info.credential || info;
    const credentialID: string = credential.id || credential.credentialID;
    const publicKeyBytes = credential.publicKey || credential.credentialPublicKey;
    const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBytes)));
    const counter: number = credential.counter ?? info.counter ?? 0;

    const { error: insertErr } = await admin.from("passkeys").insert({
      user_id: userId,
      credential_id: credentialID,
      public_key: publicKeyB64,
      counter,
      transports: response.response?.transports || [],
      device_name: (deviceName || "My device").slice(0, 64),
      aaguid: info.aaguid || null,
    });

    await admin.from("webauthn_challenges").delete().eq("id", chal.id);

    if (insertErr) {
      if (insertErr.code === "23505") {
        return new Response(JSON.stringify({ error: "This passkey is already registered" }), { status: 409, headers: corsHeaders });
      }
      throw insertErr;
    }

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("register-finish error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
