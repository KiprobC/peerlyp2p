import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "moderator" | "user";

export const useModeratorRole = () => {
  const { user } = useAuth();
  const [isModerator, setIsModerator] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setIsModerator(false);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Check for moderator role
        const { data: modData } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "moderator",
        });

        // Check for admin role
        const { data: adminData } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });

        setIsModerator(modData || false);
        setIsAdmin(adminData || false);
      } catch (error) {
        console.error("Error checking role:", error);
        setIsModerator(false);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [user]);

  return { isModerator, isAdmin, loading };
};

export interface AssignedDispute {
  id: string;
  trade_id: string;
  assigned_to: string;
  assigned_by: string;
  status: string;
  priority: string;
  notes: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  trade?: {
    id: string;
    buyer_id: string;
    seller_id: string;
    crypto_type: string;
    crypto_amount: number;
    fiat_amount: number;
    fiat_currency: string;
    payment_method: string;
    status: string;
    dispute_reason: string | null;
    disputed_by: string | null;
    created_at: string;
  };
  buyer?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    rating: number;
    total_trades: number;
    successful_trades: number;
  };
  seller?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    rating: number;
    total_trades: number;
    successful_trades: number;
  };
}

export const useModeratorDisputes = () => {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<AssignedDispute[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDisputes = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch ALL active disputes (shared queue for all moderators)
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("dispute_assignments")
        .select("*")
        .order("created_at", { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Enrich with trade and profile data
      const enrichedDisputes: AssignedDispute[] = [];

      for (const assignment of assignmentsData || []) {
        // Fetch trade details
        const { data: tradeData } = await supabase
          .from("trades")
          .select("*")
          .eq("id", assignment.trade_id)
          .single();

        let buyer = null;
        let seller = null;

        if (tradeData) {
          // Fetch buyer profile
          const { data: buyerData } = await (supabase as any)
            .from("public_profiles")
            .select("username, full_name, avatar_url, rating, total_trades, successful_trades")
            .eq("user_id", tradeData.buyer_id)
            .maybeSingle();

          const { data: sellerData } = await (supabase as any)
            .from("public_profiles")
            .select("username, full_name, avatar_url, rating, total_trades, successful_trades")
            .eq("user_id", tradeData.seller_id)
            .maybeSingle();

          buyer = buyerData;
          seller = sellerData;
        }

        enrichedDisputes.push({
          ...assignment,
          trade: tradeData || undefined,
          buyer: buyer || undefined,
          seller: seller || undefined,
        });
      }

      setDisputes(enrichedDisputes);
    } catch (error) {
      console.error("Error fetching disputes:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const resolveDispute = async (
    tradeId: string,
    resolutionType: string,
    notes: string
  ) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      // Update the dispute assignment
      const { error: updateError } = await supabase
        .from("dispute_assignments")
        .update({
          status: "resolved",
          resolution_type: resolutionType,
          resolution_notes: notes,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assigned_to: user.id,
        })
        .eq("trade_id", tradeId);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from("admin_actions").insert({
        actor_id: user.id,
        actor_role: "moderator",
        action_type: "dispute_resolved",
        target_type: "trade",
        target_id: tradeId,
        reason: notes,
        details: { resolution_type: resolutionType },
      });

      await fetchDisputes();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateStatus = async (tradeId: string, status: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    try {
      const updateData: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Record first response when moderator takes action
      if (status === "in_review") {
        updateData.first_response_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("dispute_assignments")
        .update(updateData)
        .eq("trade_id", tradeId);

      if (error) throw error;
      await fetchDisputes();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchDisputes();

    // Real-time subscription
    const channel = supabase
      .channel("moderator-disputes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dispute_assignments",
        },
        () => fetchDisputes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDisputes]);

  const pendingDisputes = disputes.filter(
    (d) => d.status === "assigned" || d.status === "in_review" || d.status === "pending"
  );
  const resolvedDisputes = disputes.filter((d) => d.status === "resolved");

  return {
    disputes,
    pendingDisputes,
    resolvedDisputes,
    loading,
    resolveDispute,
    updateStatus,
    refetch: fetchDisputes,
  };
};

export const useModeratorTradeMessages = (tradeId: string) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!tradeId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trade_messages")
        .select("*")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Enrich with sender info
      const enriched = await Promise.all(
        (data || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("user_id", msg.sender_id)
            .single();

          return {
            ...msg,
            sender_username: profile?.username,
            sender_avatar: profile?.avatar_url,
          };
        })
      );

      setMessages(enriched);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [tradeId]);

  useEffect(() => {
    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`mod-messages-${tradeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_messages",
          filter: `trade_id=eq.${tradeId}`,
        },
        () => fetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, tradeId]);

  return { messages, loading, refetch: fetchMessages };
};
