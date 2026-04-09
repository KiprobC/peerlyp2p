import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Offer {
  id: string;
  user_id: string;
  type: "buy" | "sell";
  crypto_type: string;
  crypto_amount: number;
  reserved_amount: number;
  fiat_currency: string;
  price_per_unit: number;
  price_margin: number;
  min_amount: number;
  max_amount: number;
  payment_methods: string[];
  terms: string | null;
  time_limit: number;
  is_active: boolean;
  total_trades: number;
  created_at: string;
  updated_at: string;
}

// Calculate available amount (crypto_amount - reserved_amount)
export const getAvailableAmount = (offer: Offer | OfferWithProfile): number => {
  const total = offer.crypto_amount ?? 0;
  const reserved = offer.reserved_amount ?? 0;
  return Math.max(0, total - reserved);
};

export interface OfferWithProfile extends Offer {
  trader_name?: string;
  trader_avatar?: string;
  trader_rating?: number;
  trader_trades?: number;
  trader_successful_trades?: number;
  trader_cancelled_trades?: number;
  trader_verified?: boolean;
  trader_positive_count?: number;
  trader_last_seen?: string | null;
  // Calculated fields
  available_amount?: number;
}

export interface OfferFilters {
  type?: "buy" | "sell";
  crypto_type?: string;
  payment_method?: string;
  fiat_currency?: string;
  min_amount?: number;
  max_amount?: number;
  minRating?: number;
  onlineOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export const useOffers = (filters?: OfferFilters) => {
  const [offers, setOffers] = useState<OfferWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOffers = async () => {
    try {
      let query = supabase
        .from("offers")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (filters?.type) {
        query = query.eq("type", filters.type);
      }
      if (filters?.crypto_type && filters.crypto_type !== "All") {
        query = query.eq("crypto_type", filters.crypto_type);
      }
      if (filters?.fiat_currency) {
        query = query.eq("fiat_currency", filters.fiat_currency);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(o => o.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, username, avatar_url, rating, is_verified, last_seen, successful_trades, total_trades")
          .in("user_id", userIds);
        
        // Fetch positive feedback counts for all users
        const { data: ratings } = await supabase
          .from("trade_ratings")
          .select("rated_id, rating")
          .in("rated_id", userIds)
          .gte("rating", 4);

        // Fetch completed and cancelled trade counts for success rate calculation
        const { data: trades } = await supabase
          .from("trades")
          .select("buyer_id, seller_id, status")
          .in("status", ["completed", "cancelled"])
          .or(userIds.map(id => `buyer_id.eq.${id},seller_id.eq.${id}`).join(","));

        const completedCounts: Record<string, number> = {};
        const cancelledCounts: Record<string, number> = {};
        trades?.forEach(t => {
          const isCompleted = t.status === "completed";
          const isCancelled = t.status === "cancelled";
          [t.buyer_id, t.seller_id].forEach(uid => {
            if (userIds.includes(uid)) {
              if (isCompleted) completedCounts[uid] = (completedCounts[uid] || 0) + 1;
              if (isCancelled) cancelledCounts[uid] = (cancelledCounts[uid] || 0) + 1;
            }
          });
        });

        const positiveCounts: Record<string, number> = {};
        ratings?.forEach(r => {
          positiveCounts[r.rated_id] = (positiveCounts[r.rated_id] || 0) + 1;
        });
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        
        const offersWithProfiles: OfferWithProfile[] = data.map(offer => {
          const profile = profileMap.get(offer.user_id);
          const reservedAmount = offer.reserved_amount ?? 0;
          const cryptoAmount = offer.crypto_amount ?? 0;
          const traderTrades = (completedCounts[offer.user_id] || 0) + (cancelledCounts[offer.user_id] || 0) || profile?.total_trades || 0;
          const traderSuccessfulTrades = completedCounts[offer.user_id] || 0;
          const traderCancelledTrades = cancelledCounts[offer.user_id] || 0;
          return {
            ...offer,
            reserved_amount: reservedAmount,
            price_margin: offer.price_margin || 0,
            trader_name: profile?.username || profile?.full_name || "Anonymous",
            trader_avatar: profile?.avatar_url || undefined,
            trader_rating: profile?.rating || 0,
            trader_trades: traderTrades,
            trader_successful_trades: traderSuccessfulTrades,
            trader_verified: profile?.is_verified || false,
            trader_positive_count: positiveCounts[offer.user_id] || 0,
            trader_last_seen: profile?.last_seen || null,
            available_amount: Math.max(0, cryptoAmount - reservedAmount),
          };
        });
        
        setOffers(offersWithProfiles);
      } else {
        setOffers([]);
      }
    } catch (error) {
      console.error("Error fetching offers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [filters?.type, filters?.crypto_type, filters?.payment_method, filters?.fiat_currency]);

  return { offers, loading, refetch: fetchOffers };
};

export const useMyOffers = () => {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyOffers = async () => {
    if (!user) {
      setOffers([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOffers((data as Offer[]) || []);
    } catch (error) {
      console.error("Error fetching my offers:", error);
    } finally {
      setLoading(false);
    }
  };

  const createOffer = async (offer: Omit<Offer, "id" | "user_id" | "created_at" | "updated_at" | "total_trades" | "reserved_amount">) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      // For sell offers, use the backend function with balance validation
      if (offer.type === "sell") {
        const { data, error: rpcError } = await (supabase.rpc as any)("create_sell_offer_with_reservation", {
          p_user_id: user.id,
          p_crypto_type: offer.crypto_type,
          p_crypto_amount: offer.crypto_amount,
          p_price_per_unit: offer.price_per_unit,
          p_price_margin: offer.price_margin || 0,
          p_min_amount: offer.min_amount,
          p_max_amount: offer.max_amount,
          p_payment_methods: offer.payment_methods,
          p_time_limit: offer.time_limit,
          p_terms: offer.terms || null,
          p_fiat_currency: offer.fiat_currency,
        });

        if (rpcError) throw rpcError;

        const result = data as { success: boolean; error?: string; available_balance?: number };
        if (!result.success) {
          throw new Error(result.error || "Failed to create sell offer");
        }

        await fetchMyOffers();
        return { error: null };
      }

      // For buy offers, use standard insert (no balance validation needed)
      const { error } = await supabase.from("offers").insert({
        ...offer,
        user_id: user.id,
        reserved_amount: 0, // Buy offers don't reserve balance
      });

      if (error) throw error;
      await fetchMyOffers();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const updateOffer = async (id: string, updates: Partial<Offer>) => {
    try {
      const { error } = await supabase
        .from("offers")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      await fetchMyOffers();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const deleteOffer = async (id: string) => {
    try {
      const { error } = await supabase
        .from("offers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchMyOffers();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  useEffect(() => {
    fetchMyOffers();
  }, [user]);

  return { offers, loading, createOffer, updateOffer, deleteOffer, refetch: fetchMyOffers };
};
