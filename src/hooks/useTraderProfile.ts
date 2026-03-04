import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TraderProfileData {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  country: string | null;
  created_at: string;
  last_seen: string | null;
}

export interface TraderMetrics {
  totalTrades: number;
  completedTrades: number;
  completionRate: number;
  disputeCount: number;
  disputeRate: number;
  avgReleaseTimeMinutes: number | null;
  totalVolume: number;
  volumeCurrency: string;
}

export interface TraderReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rater_username: string | null;
}

export interface TraderPaymentMethod {
  name: string;
  display_name: string;
}

export const useTraderProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TraderProfileData | null>(null);
  const [metrics, setMetrics] = useState<TraderMetrics | null>(null);
  const [reviews, setReviews] = useState<TraderReview[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<TraderPaymentMethod[]>([]);
  const [isTrusted, setIsTrusted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async (targetUserId: string) => {
    if (!targetUserId) return;
    setLoading(true);

    try {
      // Parallel fetches
      const [profileRes, tradesRes, ratingsRes, trustRes, blockRes, offersRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, full_name, avatar_url, is_verified, country, created_at, last_seen")
          .eq("user_id", targetUserId)
          .single(),
        supabase
          .from("trades")
          .select("status, fiat_amount, fiat_currency, completed_at, payment_confirmed_at, created_at")
          .or(`buyer_id.eq.${targetUserId},seller_id.eq.${targetUserId}`),
        supabase
          .from("trade_ratings")
          .select("id, rating, comment, created_at, rater_id")
          .eq("rated_id", targetUserId)
          .order("created_at", { ascending: false }),
        user ? supabase
          .from("user_trusts")
          .select("id")
          .eq("user_id", user.id)
          .eq("trusted_user_id", targetUserId)
          .maybeSingle() : Promise.resolve({ data: null }),
        user ? supabase
          .from("user_blocks")
          .select("id")
          .eq("user_id", user.id)
          .eq("blocked_user_id", targetUserId)
          .maybeSingle() : Promise.resolve({ data: null }),
        supabase
          .from("offers")
          .select("payment_methods")
          .eq("user_id", targetUserId)
          .eq("is_active", true),
      ]);

      // Profile
      if (profileRes.data) setProfile(profileRes.data);

      // Trust/Block status
      setIsTrusted(!!trustRes.data);
      setIsBlocked(!!blockRes.data);

      // Metrics
      const trades = tradesRes.data || [];
      const totalTrades = trades.length;
      const completedTrades = trades.filter(t => t.status === "completed").length;
      const disputedTrades = trades.filter(t => t.status === "disputed").length;
      const completionRate = totalTrades > 0 ? Math.round((completedTrades / totalTrades) * 100) : 0;
      const disputeRate = totalTrades > 0 ? Math.round((disputedTrades / totalTrades) * 100) : 0;

      // Volume from completed trades
      const completedTradesList = trades.filter(t => t.status === "completed");
      const totalVolume = completedTradesList.reduce((sum, t) => sum + (t.fiat_amount || 0), 0);
      const volumeCurrency = completedTradesList[0]?.fiat_currency || "KES";

      // Average release time (from payment_confirmed_at to completed_at)
      let avgReleaseTimeMinutes: number | null = null;
      const releaseTimes = completedTradesList
        .filter(t => t.payment_confirmed_at && t.completed_at)
        .map(t => {
          const confirmed = new Date(t.payment_confirmed_at!).getTime();
          const completed = new Date(t.completed_at!).getTime();
          return (completed - confirmed) / (1000 * 60);
        })
        .filter(m => m > 0 && m < 10080); // filter out unreasonable values (>7 days)

      if (releaseTimes.length > 0) {
        avgReleaseTimeMinutes = Math.round(releaseTimes.reduce((a, b) => a + b, 0) / releaseTimes.length);
      }

      setMetrics({
        totalTrades,
        completedTrades,
        completionRate,
        disputeCount: disputedTrades,
        disputeRate,
        avgReleaseTimeMinutes,
        totalVolume,
        volumeCurrency,
      });

      // Reviews with rater names
      const ratings = ratingsRes.data || [];
      if (ratings.length > 0) {
        const raterIds = [...new Set(ratings.map(r => r.rater_id))];
        const { data: raterProfiles } = await supabase
          .from("profiles")
          .select("user_id, username")
          .in("user_id", raterIds);

        const raterMap = new Map(raterProfiles?.map(p => [p.user_id, p.username]) || []);

        setReviews(ratings.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          rater_username: raterMap.get(r.rater_id) || null,
        })));
      } else {
        setReviews([]);
      }

      // Payment methods from active offers
      const allMethods = new Set<string>();
      offersRes.data?.forEach(o => o.payment_methods?.forEach((m: string) => allMethods.add(m)));
      
      if (allMethods.size > 0) {
        const { data: pmData } = await supabase
          .from("payment_methods")
          .select("name, display_name")
          .in("name", Array.from(allMethods));
        setPaymentMethods(pmData || Array.from(allMethods).map(m => ({ name: m, display_name: m })));
      } else {
        setPaymentMethods([]);
      }
    } catch (error) {
      console.error("Error fetching trader profile:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const toggleTrust = useCallback(async (targetUserId: string) => {
    if (!user) return;
    try {
      if (isTrusted) {
        await supabase.from("user_trusts").delete().eq("user_id", user.id).eq("trusted_user_id", targetUserId);
        setIsTrusted(false);
      } else {
        await supabase.from("user_trusts").insert({ user_id: user.id, trusted_user_id: targetUserId });
        setIsTrusted(true);
      }
    } catch (error) {
      console.error("Error toggling trust:", error);
    }
  }, [user, isTrusted]);

  const toggleBlock = useCallback(async (targetUserId: string) => {
    if (!user) return;
    try {
      if (isBlocked) {
        await supabase.from("user_blocks").delete().eq("user_id", user.id).eq("blocked_user_id", targetUserId);
        setIsBlocked(false);
      } else {
        await supabase.from("user_blocks").insert({ user_id: user.id, blocked_user_id: targetUserId });
        setIsBlocked(true);
        // Also remove trust if blocking
        if (isTrusted) {
          await supabase.from("user_trusts").delete().eq("user_id", user.id).eq("trusted_user_id", targetUserId);
          setIsTrusted(false);
        }
      }
    } catch (error) {
      console.error("Error toggling block:", error);
    }
  }, [user, isBlocked, isTrusted]);

  return { profile, metrics, reviews, paymentMethods, isTrusted, isBlocked, loading, fetchAll, toggleTrust, toggleBlock };
};
