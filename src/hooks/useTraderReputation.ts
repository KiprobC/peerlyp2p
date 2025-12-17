import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TraderReputation {
  positiveCount: number;
  totalTrades: number;
  recentFeedback: {
    rating: number;
    comment: string | null;
    created_at: string;
    rater_name: string | null;
  }[];
}

export const useTraderReputation = (userId: string | undefined) => {
  const [reputation, setReputation] = useState<TraderReputation>({
    positiveCount: 0,
    totalTrades: 0,
    recentFeedback: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchReputation = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all ratings where this user was rated
      const { data: ratings, error: ratingsError } = await supabase
        .from("trade_ratings")
        .select(`
          rating,
          comment,
          created_at,
          rater_id
        `)
        .eq("rated_id", userId)
        .order("created_at", { ascending: false });

      if (ratingsError) throw ratingsError;

      // Count positive feedback (4-5 stars)
      const positiveCount = ratings?.filter(r => r.rating >= 4).length || 0;

      // Fetch rater profiles for recent feedback
      const recentRatings = ratings?.slice(0, 5) || [];
      const raterIds = recentRatings.map(r => r.rater_id);
      
      let raterProfiles: Record<string, string> = {};
      if (raterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, full_name")
          .in("user_id", raterIds);
        
        profiles?.forEach(p => {
          raterProfiles[p.user_id] = p.username || p.full_name || "Anonymous";
        });
      }

      // Fetch total completed trades
      const { count: totalTrades } = await supabase
        .from("trades")
        .select("*", { count: "exact", head: true })
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .eq("status", "completed");

      setReputation({
        positiveCount,
        totalTrades: totalTrades || 0,
        recentFeedback: recentRatings.map(r => ({
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          rater_name: raterProfiles[r.rater_id] || "Anonymous",
        })),
      });
    } catch (error) {
      console.error("Error fetching trader reputation:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchReputation();
  }, [fetchReputation]);

  return { reputation, loading, refetch: fetchReputation };
};

// Helper to calculate positive percentage
export const getPositivePercentage = (positiveCount: number, totalRatings: number): number => {
  if (totalRatings === 0) return 0;
  return Math.round((positiveCount / totalRatings) * 100);
};
