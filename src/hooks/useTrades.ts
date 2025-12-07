import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  buyer_rating: number | null;
  seller_rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface TradeMessage {
  id: string;
  trade_id: string;
  sender_id: string;
  message: string;
  is_system: boolean;
  read_at: string | null;
  created_at: string;
}

export const useTrades = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

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
      setTrades((data as Trade[]) || []);
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
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("trades-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trades",
        },
        (payload) => {
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

export const useTradeMessages = (tradeId: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("trade_messages")
        .select("*")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data as TradeMessage[]) || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      const { error } = await supabase.from("trade_messages").insert({
        trade_id: tradeId,
        sender_id: user.id,
        message,
      });

      if (error) throw error;
      await fetchMessages();
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [tradeId]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`trade-messages-${tradeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_messages",
          filter: `trade_id=eq.${tradeId}`,
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as TradeMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tradeId]);

  return { messages, loading, sendMessage, refetch: fetchMessages };
};
