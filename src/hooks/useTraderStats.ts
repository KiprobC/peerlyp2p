import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TraderStats {
  totalTrades: number;
  completedTrades: number;
  successRate: number;
  rating: number;
}

/**
 * Hook to fetch dynamic trader statistics from the trades table.
 * This is the single source of truth for trade counts, not the static profile fields.
 */
export const useTraderStats = (userId?: string) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const [stats, setStats] = useState<TraderStats>({
    totalTrades: 0,
    completedTrades: 0,
    successRate: 0,
    rating: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all trades where user is buyer or seller
      const { data: trades, error: tradesError } = await supabase
        .from("trades")
        .select("status")
        .or(`buyer_id.eq.${targetUserId},seller_id.eq.${targetUserId}`);

      if (tradesError) throw tradesError;

      const totalTrades = trades?.length || 0;
      const completedTrades = trades?.filter(t => t.status === "completed").length || 0;
      const successRate = totalTrades > 0 ? Math.round((completedTrades / totalTrades) * 100) : 0;

      // Fetch rating from profile (this is calculated from trade_ratings)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("rating")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (profileError) throw profileError;

      setStats({
        totalTrades,
        completedTrades,
        successRate,
        rating: profile?.rating || 0,
      });
    } catch (error) {
      console.error("Error fetching trader stats:", error);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
};

/**
 * Utility function to fetch trader stats for a specific user (non-hook version for one-off fetches)
 */
export const fetchTraderStatsById = async (userId: string): Promise<TraderStats> => {
  try {
    const { data: trades } = await supabase
      .from("trades")
      .select("status")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

    const totalTrades = trades?.length || 0;
    const completedTrades = trades?.filter(t => t.status === "completed").length || 0;
    const successRate = totalTrades > 0 ? Math.round((completedTrades / totalTrades) * 100) : 0;

    const { data: profile } = await supabase
      .from("profiles")
      .select("rating")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      totalTrades,
      completedTrades,
      successRate,
      rating: profile?.rating || 0,
    };
  } catch (error) {
    console.error("Error fetching trader stats:", error);
    return { totalTrades: 0, completedTrades: 0, successRate: 0, rating: 0 };
  }
};
