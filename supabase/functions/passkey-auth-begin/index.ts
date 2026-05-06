import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { generateAuthenticationOptions } from "https://esm.sh/@simplewebauthn/server@13.1.1";

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
    const { email, purpose } = await req.json().catch(() => ({}));
    const _purpose = purpose === "step_up" ? "step_up" : "authentication";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
      userId = (claims?.claims?.sub as string) || null;
    }

    if (!userId && email) {
      const { data: profile } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
      userId = profile?.user_id || null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ hasPasskey: false, options: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: keys } = await admin
      .from("passkeys")
      .select("credential_id, transports")
      .eq("user_id", userId);

    if (!keys || keys.length === 0) {
      return new Response(JSON.stringify({ hasPasskey: false, options: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rpID } = rpFromOrigin(req.headers.get("Origin"));
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      allowCredentials: keys.map((k: any) => ({
        id: k.credential_id,
        transports: k.transports,
      })),
    });

    await admin.from("webauthn_challenges").insert({
      user_id: userId,
      email: email || null,
      challenge: options.challenge,
      purpose: _purpose,
    });

    return new Response(JSON.stringify({ hasPasskey: true, options }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auth-begin error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
