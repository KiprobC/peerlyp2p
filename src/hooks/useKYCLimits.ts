import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type KYCTier = "unverified" | "level_1" | "level_2" | "level_3";

export interface KYCTierLimits {
  tier: KYCTier;
  max_single_trade_amount: number;
  daily_trade_limit: number;
  monthly_trade_limit: number;
  can_create_buy_offers: boolean;
  can_create_sell_offers: boolean;
  allowed_payment_methods: string[];
  max_active_offers: number;
  max_daily_trades: number;
  description: string;
}

export interface UserTradingStats {
  daily_trade_volume: number;
  daily_trade_count: number;
  monthly_trade_volume: number;
  monthly_trade_count: number;
  daily_reset_at: string;
  monthly_reset_at: string;
}

export interface ValidationResult {
  allowed: boolean;
  error_code?: string;
  message?: string;
  required_tier?: KYCTier;
  allowed_methods?: string[];
  max_allowed?: number;
  requested?: number;
  daily_limit?: number;
  monthly_limit?: number;
  current_usage?: number;
  remaining_daily?: number;
  remaining_monthly?: number;
  tier?: KYCTier;
  retry_after?: number;
}

// Fetch all KYC tier limits
export function useKYCTierLimits() {
  return useQuery({
    queryKey: ["kyc-tier-limits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kyc_tier_limits")
        .select("*")
        .order("tier");
      
      if (error) throw error;
      return data as KYCTierLimits[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

// Get user's current KYC tier
export function useUserKYCTier() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-kyc-tier", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase.rpc("get_user_kyc_tier", {
        p_user_id: user.id,
      });
      
      if (error) throw error;
      return data as KYCTier;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60, // Cache for 1 minute
  });
}

// Get user's current tier limits
export function useUserTierLimits() {
  const { data: tier } = useUserKYCTier();
  const { data: allLimits } = useKYCTierLimits();

  if (!tier || !allLimits) return null;
  return allLimits.find(l => l.tier === tier) || null;
}

// Get user's trading stats
export function useUserTradingStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-trading-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("user_trading_stats")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserTradingStats | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // Cache for 30 seconds
  });
}

// Validate an action before performing it
export async function validateAction(
  action: string,
  amount: number = 0,
  paymentMethod: string | null = null
): Promise<ValidationResult> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return {
      allowed: false,
      error_code: "UNAUTHORIZED",
      message: "Please log in to continue",
    };
  }

  try {
    const response = await supabase.functions.invoke("validate-action", {
      body: { action, amount, payment_method: paymentMethod },
    });

    // If we got data back, use it even if there's an "error" (non-2xx status)
    if (response.data && typeof response.data === "object" && "allowed" in response.data) {
      return response.data as ValidationResult;
    }

    if (response.error) {
      console.error("Validation error:", response.error);
      return {
        allowed: false,
        error_code: "VALIDATION_ERROR",
        message: "Unable to validate action. Please try again.",
      };
    }

    return response.data as ValidationResult;
  } catch (error) {
    console.error("Validation request failed:", error);
    return {
      allowed: false,
      error_code: "NETWORK_ERROR",
      message: "Unable to connect. Please check your connection.",
    };
  }
}

// Get tier display info
export function getTierInfo(tier: KYCTier) {
  const tierInfo: Record<KYCTier, { label: string; color: string; icon: string }> = {
    unverified: { label: "Unverified", color: "text-muted-foreground", icon: "⚪" },
    level_1: { label: "Level 1", color: "text-blue-500", icon: "🔵" },
    level_2: { label: "Level 2", color: "text-amber-500", icon: "🟡" },
    level_3: { label: "Level 3", color: "text-green-500", icon: "🟢" },
  };
  return tierInfo[tier];
}

// Format currency for display
export function formatLimit(amount: number, currency: string = "KES") {
  if (amount >= 1000000) {
    return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${currency} ${(amount / 1000).toFixed(0)}K`;
  }
  return `${currency} ${amount}`;
}