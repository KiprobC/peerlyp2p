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
  avgRating: number;
  ratingCount: number;
  uniqueReviewers: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
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
      // Parallel fetches using secure RPC functions for stats/reviews
      const [profileRes, statsRes, reviewsRes, trustRes, blockRes, offersRes] = await Promise.all([
        (supabase as any)
          .from("public_profiles")
          .select("username, full_name, avatar_url, is_verified, country, created_at, last_seen")
          .eq("user_id", targetUserId)
          .maybeSingle(),
        supabase.rpc("get_trader_public_stats", { p_user_id: targetUserId }),
        supabase.rpc("get_trader_reviews", { p_user_id: targetUserId }),
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

      // Metrics from RPC
      if (statsRes.data) {
        const s = statsRes.data as Record<string, unknown>;
        setMetrics({
          totalTrades: Number(s.totalTrades) || 0,
          completedTrades: Number(s.completedTrades) || 0,
          completionRate: Number(s.completionRate) || 0,
          disputeCount: Number(s.disputeCount) || 0,
          disputeRate: Number(s.disputeRate) || 0,
          avgReleaseTimeMinutes: s.avgReleaseTimeMinutes != null ? Number(s.avgReleaseTimeMinutes) : null,
          totalVolume: Number(s.totalVolume) || 0,
          volumeCurrency: (s.volumeCurrency as string) || "KES",
          avgRating: Number(s.avgRating) || 0,
          ratingCount: Number(s.ratingCount) || 0,
          uniqueReviewers: Number(s.uniqueReviewers) || 0,
          positiveCount: Number(s.positiveCount) || 0,
          neutralCount: Number(s.neutralCount) || 0,
          negativeCount: Number(s.negativeCount) || 0,
        });
      }

      // Reviews from RPC
      if (reviewsRes.data && Array.isArray(reviewsRes.data)) {
        setReviews((reviewsRes.data as unknown as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          rating: Number(r.rating),
          comment: (r.comment as string) || null,
          created_at: r.created_at as string,
          rater_username: (r.rater_username as string) || null,
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
