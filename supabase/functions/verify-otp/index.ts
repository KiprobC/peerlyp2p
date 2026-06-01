import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  action: "generate" | "verify" | "resend";
  actionType: string;
  code?: string;
  metadata?: Record<string, unknown>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's auth for claims verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user's token
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.user.id;
    const userEmail = claimsData.user.email;

    // Create service client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: OTPRequest = await req.json();
    const { action, actionType, code, metadata } = body;

    // Get client info for logging
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (action === "generate" || action === "resend") {
      // Generate OTP using database function
      const { data, error } = await supabaseAdmin.rpc("generate_otp_code", {
        p_user_id: userId,
        p_action_type: actionType,
        p_method: "email",
        p_expiry_minutes: 10,
        p_metadata: metadata || null,
      });

      if (error) {
        console.error("Error generating OTP:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = data as { success: boolean; code?: string; error?: string; locked_until?: string };

      if (!result.success) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: result.error,
            lockedUntil: result.locked_until 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // In production, send email here via Resend/SendGrid
      // For now, we log it (development mode)
      console.log(`[DEV] OTP for user ${userEmail}: ${result.code} (action: ${actionType})`);

      // Log the generation event
      await supabaseAdmin.from("security_events").insert({
        user_id: userId,
        action_type: "otp_requested",
        method: "email",
        status: "success",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { action: actionType, email: userEmail },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Verification code sent to your email",
          expiresInMinutes: 10,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      if (!code || code.length !== 6) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid code format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify OTP using database function
      const { data, error } = await supabaseAdmin.rpc("verify_otp_code", {
        p_user_id: userId,
        p_code: code,
        p_action_type: actionType,
      });

      if (error) {
        console.error("Error verifying OTP:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = data as { success: boolean; error?: string; attempts_remaining?: number; locked_until?: string };

      // Log verification attempt
      await supabaseAdmin.from("security_events").insert({
        user_id: userId,
        action_type: `otp_verify_${actionType}`,
        method: "email",
        status: result.success ? "success" : "failed",
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { 
          action: actionType,
          attemptsRemaining: result.attempts_remaining,
        },
      });

      if (!result.success) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: result.error,
            attemptsRemaining: result.attempts_remaining,
            lockedUntil: result.locked_until,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in verify-otp function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);