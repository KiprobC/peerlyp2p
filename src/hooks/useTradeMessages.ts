import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TradeMessage {
  id: string;
  trade_id: string;
  sender_id: string;
  message: string;
  is_system: boolean;
  read_at: string | null;
  created_at: string;
}

/**
 * Deduplicated trade messages hook with single realtime subscription
 * - Ensures only ONE subscription per trade_id
 * - Deduplicates messages by ID before state updates
 * - Proper cleanup on unmount
 * - No optimistic updates - only renders confirmed messages
 */
export const useTradeMessages = (tradeId: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TradeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Refs to prevent re-subscription and track state
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);
  const tradeIdRef = useRef(tradeId);
  const messageIdsRef = useRef(new Set<string>());

  // Deduplicate helper - returns only new messages
  const deduplicateMessages = useCallback((
    existingMessages: TradeMessage[], 
    newMessages: TradeMessage[]
  ): TradeMessage[] => {
    const existingIds = new Set(existingMessages.map(m => m.id));
    const uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
    return uniqueNew;
  }, []);

  // Add message with deduplication
  const addMessage = useCallback((newMessage: TradeMessage) => {
    // Check ref first for quick duplicate rejection
    if (messageIdsRef.current.has(newMessage.id)) {
      console.log(`[TradeMessages] Duplicate rejected: ${newMessage.id}`);
      return;
    }
    
    console.log(`[TradeMessages] Adding message: ${newMessage.id}`);
    messageIdsRef.current.add(newMessage.id);
    
    setMessages(prev => {
      // Double-check state for race conditions
      if (prev.some(m => m.id === newMessage.id)) {
        return prev;
      }
      return [...prev, newMessage];
    });
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!tradeId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      console.log(`[TradeMessages] Fetching messages for trade: ${tradeId}`);
      const { data, error } = await supabase
        .from("trade_messages")
        .select("*")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      const fetchedMessages = (data as TradeMessage[]) || [];
      
      // Update ref with all fetched message IDs
      messageIdsRef.current = new Set(fetchedMessages.map(m => m.id));
      
      setMessages(fetchedMessages);
      console.log(`[TradeMessages] Fetched ${fetchedMessages.length} messages`);
    } catch (error) {
      console.error("[TradeMessages] Error fetching:", error);
    } finally {
      setLoading(false);
    }
  }, [tradeId]);

  // Send message - single insert, no optimistic update
  const sendMessage = useCallback(async (message: string) => {
    if (!user || !tradeId || !message.trim()) {
      return { error: new Error("Invalid message data") };
    }

    setSending(true);
    console.log(`[TradeMessages] Sending message to trade: ${tradeId}`);

    try {
      const { data, error } = await supabase
        .from("trade_messages")
        .insert({
          trade_id: tradeId,
          sender_id: user.id,
          message: message.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Message will arrive via realtime subscription
      // Only add directly if subscription isn't active (fallback)
      if (!isSubscribedRef.current && data) {
        addMessage(data as TradeMessage);
      }

      console.log(`[TradeMessages] Message sent: ${data?.id}`);
      return { error: null, data };
    } catch (error: any) {
      console.error("[TradeMessages] Send error:", error);
      return { error };
    } finally {
      setSending(false);
    }
  }, [user, tradeId, addMessage]);

  // Setup subscription - only once per trade
  useEffect(() => {
    if (!tradeId) return;

    // If trade changed, cleanup old subscription
    if (tradeIdRef.current !== tradeId && subscriptionRef.current) {
      console.log(`[TradeMessages] Trade changed, cleaning up old subscription`);
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
      isSubscribedRef.current = false;
      messageIdsRef.current.clear();
    }
    
    tradeIdRef.current = tradeId;

    // Fetch initial messages
    fetchMessages();

    // Don't create duplicate subscription
    if (isSubscribedRef.current) {
      console.log(`[TradeMessages] Subscription already active for: ${tradeId}`);
      return;
    }

    console.log(`[TradeMessages] Creating subscription for trade: ${tradeId}`);
    
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
          console.log(`[TradeMessages] Realtime INSERT received:`, payload.new.id);
          addMessage(payload.new as TradeMessage);
        }
      )
      .subscribe((status) => {
        console.log(`[TradeMessages] Subscription status: ${status}`);
        if (status === "SUBSCRIBED") {
          isSubscribedRef.current = true;
        }
      });

    subscriptionRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log(`[TradeMessages] Cleaning up subscription for: ${tradeId}`);
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      isSubscribedRef.current = false;
    };
  }, [tradeId, fetchMessages, addMessage]);

  return { 
    messages, 
    loading, 
    sending,
    sendMessage, 
    refetch: fetchMessages 
  };
};
