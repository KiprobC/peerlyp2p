import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Offer {
  id: string;
  user_id: string;
  type: "buy" | "sell";
  crypto_type: string;
  crypto_amount: number;
  fiat_currency: string;
  price_per_unit: number;
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

export interface OfferWithProfile extends Offer {
  trader_name?: string;
  trader_avatar?: string;
  trader_rating?: number;
  trader_trades?: number;
  trader_verified?: boolean;
}

export interface OfferFilters {
  type?: "buy" | "sell";
  crypto_type?: string;
  payment_method?: string;
  min_amount?: number;
  max_amount?: number;
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

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(o => o.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, rating, total_trades, is_verified")
          .in("user_id", userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        
        const offersWithProfiles: OfferWithProfile[] = data.map(offer => {
          const profile = profileMap.get(offer.user_id);
          return {
            ...offer,
            trader_name: profile?.full_name || "Anonymous",
            trader_avatar: profile?.avatar_url || undefined,
            trader_rating: profile?.rating || 0,
            trader_trades: profile?.total_trades || 0,
            trader_verified: profile?.is_verified || false,
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
  }, [filters?.type, filters?.crypto_type, filters?.payment_method]);

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

  const createOffer = async (offer: Omit<Offer, "id" | "user_id" | "created_at" | "updated_at" | "total_trades">) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      const { error } = await supabase.from("offers").insert({
        ...offer,
        user_id: user.id,
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
