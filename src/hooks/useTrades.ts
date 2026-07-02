import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TradeProfile {
  username: string | null;
}

export interface Trade {
  id: string;
  offer_id: string;
  buyer_id: string;
  seller_id: string;
  crypto_type: string;
  crypto_amount: number;
  fiat_amount: number;
  fiat_currency: string;
  payment_method: string;
  status: "pending" | "confirmed" | "payment_sent" | "completed" | "disputed" | "cancelled";
  escrow_locked: boolean;
  escrow_released: boolean;
  payment_confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  dispute_reason: string | null;
  disputed_at: string | null;
  disputed_by: string | null;
  assigned_moderator_id: string | null;
  resolution_type: string | null;
  dispute_resolution_summary: string | null;
  buyer_rating: number | null;
  seller_rating: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  buyer_profile?: TradeProfile;
  seller_profile?: TradeProfile;
}

// TradeMessage type moved to useTradeMessages.ts hook
export type { TradeMessage } from "./useTradeMessages";

// Simple notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.error("Error playing notification sound:", error);
  }
};

export const useTrades = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const lastSoundPlayedRef = useRef<number>(0);
  const userOffersRef = useRef<Set<string>>(new Set());

  // Fetch user's offer IDs
  const fetchUserOffers = useCallback(async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("offers")
      .select("id")
      .eq("user_id", user.id);
    
    if (data) {
      userOffersRef.current = new Set(data.map(o => o.id));
    }
  }, [user]);

  const fetchTrades = async () => {
    if (!user) {
      setTrades([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch profiles for all trades
      if (data && data.length > 0) {
        const userIds = new Set<string>();
        data.forEach((trade: any) => {
          userIds.add(trade.buyer_id);
          userIds.add(trade.seller_id);
        });
        
        const { data: profiles } = await (supabase as any)
          .from("public_profiles")
          .select("user_id, username")
          .in("user_id", Array.from(userIds));
        
        const profileMap = new Map<string, TradeProfile>();
        profiles?.forEach((p: any) => {
          profileMap.set(p.user_id, { username: p.username });
        });
        
        const tradesWithProfiles = data.map((trade: any) => ({
          ...trade,
          buyer_profile: profileMap.get(trade.buyer_id) || { username: null },
          seller_profile: profileMap.get(trade.seller_id) || { username: null },
        }));
        
        setTrades(tradesWithProfiles as Trade[]);
      } else {
        setTrades([]);
      }
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const createTrade = async (trade: {
    offer_id: string;
    buyer_id: string;
    seller_id: string;
    crypto_type: string;
    crypto_amount: number;
    fiat_amount: number;
    fiat_currency: string;
    payment_method: string;
  }) => {
    if (!user) return { error: new Error("Not authenticated"), data: null };

    try {
      const { data, error } = await supabase
        .from("trades")
        .insert(trade)
        .select()
        .single();

      if (error) throw error;
      await fetchTrades();
      return { error: null, data: data as Trade };
    } catch (error: any) {
      return { error, data: null };
    }
  };

  const updateTrade = async (id: string, updates: Partial<Trade>) => {
    try {
      const { error } = await supabase
        .from("trades")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      await fetchTrades();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  useEffect(() => {
    fetchTrades();
    fetchUserOffers();
  }, [user, fetchUserOffers]);

  // Real-time subscription with notification sound
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("trades-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
        },
        (payload) => {
          const newTrade = payload.new as Trade;
          
          // Check if this trade is on one of user's offers and user is the seller
          if (userOffersRef.current.has(newTrade.offer_id) && newTrade.seller_id === user.id) {
            // Play sound only once per second max
            const now = Date.now();
            if (now - lastSoundPlayedRef.current > 1000) {
              lastSoundPlayedRef.current = now;
              playNotificationSound();
            }
          }
          
          fetchTrades();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trades",
        },
        () => {
          fetchTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const activeTrades = trades.filter(t => 
    ["pending", "confirmed", "payment_sent"].includes(t.status)
  );

  const completedTrades = trades.filter(t => t.status === "completed");

  return { 
    trades, 
    activeTrades,
    completedTrades,
    loading, 
    createTrade, 
    updateTrade, 
    refetch: fetchTrades 
  };
};

// useTradeMessages hook has been extracted to a separate file for better maintainability
// and to fix message deduplication issues
export { useTradeMessages } from "./useTradeMessages";
