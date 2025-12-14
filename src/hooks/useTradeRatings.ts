import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TradeRating {
  id: string;
  trade_id: string;
  rater_id: string;
  rated_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export const useTradeRatings = (tradeId?: string) => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<TradeRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRated, setHasRated] = useState(false);

  const fetchRatings = async () => {
    if (!tradeId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("trade_ratings")
        .select("*")
        .eq("trade_id", tradeId);

      if (error) throw error;
      setRatings(data || []);

      // Check if current user has already rated
      if (user) {
        setHasRated(data?.some((r) => r.rater_id === user.id) || false);
      }
    } catch (error) {
      console.error("Error fetching ratings:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUserRatings = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("trade_ratings")
        .select("*")
        .eq("rated_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching user ratings:", error);
      return [];
    }
  };

  useEffect(() => {
    fetchRatings();
  }, [tradeId, user]);

  return { ratings, loading, hasRated, refetch: fetchRatings, getUserRatings };
};
