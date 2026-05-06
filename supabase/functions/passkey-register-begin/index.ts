import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { generateRegistrationOptions } from "https://esm.sh/@simplewebauthn/server@13.1.1";

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
    const userEmail = (claims.claims.email as string) || "user";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await admin.from("passkeys").select("credential_id, transports").eq("user_id", userId);

    const { rpID } = rpFromOrigin(req.headers.get("Origin"));

    const options = await generateRegistrationOptions({
      rpName: "Peerly",
      rpID,
      userID: new TextEncoder().encode(userId),
      userName: userEmail,
      userDisplayName: userEmail,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: (existing || []).map((c: any) => ({
        id: c.credential_id,
        transports: c.transports,
      })),
    });

    await admin.from("webauthn_challenges").insert({
      user_id: userId,
      challenge: options.challenge,
      purpose: "registration",
    });

    return new Response(JSON.stringify({ options }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("register-begin error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
