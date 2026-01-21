import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotificationSound } from "./useNotificationSound";
import { toast } from "sonner";

export interface ModeratorNotification {
  id: string;
  trade_id: string;
  assigned_to: string;
  assigned_by: string | null;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  trade?: {
    crypto_type: string;
    crypto_amount: number;
    fiat_amount: number;
    fiat_currency: string;
    buyer_id: string;
    seller_id: string;
  };
}

export const useModeratorNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ModeratorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { playNotificationSound } = useNotificationSound();
  const isInitialLoadRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("dispute_assignments")
        .select(`
          *,
          trade:trades(
            crypto_type,
            crypto_amount,
            fiat_amount,
            fiat_currency,
            buyer_id,
            seller_id
          )
        `)
        .eq("assigned_to", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications((data as ModeratorNotification[]) || []);
    } catch (error) {
      console.error("Error fetching moderator notifications:", error);
    } finally {
      setLoading(false);
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1000);
    }
  }, [user]);

  const markAsViewed = async (id: string) => {
    try {
      const { error } = await supabase
        .from("dispute_assignments")
        .update({ status: "in_progress" })
        .eq("id", id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Error marking notification as viewed:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription for new dispute assignments
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("moderator-dispute-assignments")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dispute_assignments",
          filter: `assigned_to=eq.${user.id}`,
        },
        async (payload) => {
          const newAssignment = payload.new as ModeratorNotification;
          
          // Fetch trade details for the new assignment
          const { data: tradeData } = await supabase
            .from("trades")
            .select("crypto_type, crypto_amount, fiat_amount, fiat_currency, buyer_id, seller_id")
            .eq("id", newAssignment.trade_id)
            .single();

          const fullNotification = {
            ...newAssignment,
            trade: tradeData
          };

          setNotifications(prev => [fullNotification, ...prev]);

          // Play sound and show toast for new assignments (not during initial load)
          if (!isInitialLoadRef.current) {
            playNotificationSound("trade");
            toast.warning("New Dispute Assigned", {
              description: `A ${newAssignment.priority || 'normal'} priority dispute requires your attention.`,
              duration: 8000,
              action: {
                label: "Review",
                onClick: () => {
                  window.location.href = `/trade/${newAssignment.trade_id}`;
                },
              },
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "dispute_assignments",
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as ModeratorNotification;
          if (updated.status !== "pending") {
            setNotifications(prev => prev.filter(n => n.id !== updated.id));
          } else {
            setNotifications(prev =>
              prev.map(n => (n.id === updated.id ? { ...n, ...updated } : n))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playNotificationSound]);

  const unreadCount = notifications.length;

  return {
    notifications,
    unreadCount,
    loading,
    markAsViewed,
    refetch: fetchNotifications,
  };
};
