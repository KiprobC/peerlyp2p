import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidationRequest {
  action: string;
  amount?: number;
  payment_method?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ allowed: false, error_code: "UNAUTHORIZED", message: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user client to verify token
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ allowed: false, error_code: "UNAUTHORIZED", message: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body: ValidationRequest = await req.json();
    const { action, amount = 0, payment_method = null } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ allowed: false, error_code: "INVALID_REQUEST", message: "Action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP address from headers (may be forwarded)
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("x-real-ip") 
      || "unknown";

    console.log(`[validate-action] User ${user.id} attempting ${action} for amount ${amount}`);

    // Call the validation function
    const { data, error } = await supabaseAdmin.rpc("validate_trade_action", {
      p_user_id: user.id,
      p_action: action,
      p_amount: amount,
      p_payment_method: payment_method,
      p_ip_address: ipAddress,
    });

    if (error) {
      console.error("[validate-action] RPC error:", error);
      return new Response(
        JSON.stringify({ allowed: false, error_code: "VALIDATION_ERROR", message: "Unable to validate action" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[validate-action] Result:`, data);

    // Return the validation result
    const statusCode = data.allowed ? 200 : 403;
    return new Response(
      JSON.stringify(data),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[validate-action] Unexpected error:", error);
    return new Response(
      JSON.stringify({ allowed: false, error_code: "SERVER_ERROR", message: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});