import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Json } from "@/integrations/supabase/types";
import { useNotificationSound, NotificationSoundType } from "./useNotificationSound";

export interface Notification {
  id: string;
  user_id: string;
  type: "trade" | "payment" | "kyc" | "system" | "message";
  title: string;
  message: string;
  data: Json;
  read: boolean;
  created_at: string;
}

// Notification types that should trigger a sound
const SOUND_ENABLED_TYPES: NotificationSoundType[] = ["trade", "payment", "message", "kyc"];

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { playNotificationSound } = useNotificationSound();
  const isInitialLoadRef = useRef(true);

  const fetchNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
      // Mark initial load as complete after a short delay
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1000);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) throw error;
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Real-time subscription with sound
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          
          // Play distinct sound based on notification type (not during initial load)
          if (!isInitialLoadRef.current && SOUND_ENABLED_TYPES.includes(newNotification.type as NotificationSoundType)) {
            playNotificationSound(newNotification.type as NotificationSoundType);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, playNotificationSound]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { 
    notifications, 
    unreadCount,
    loading, 
    markAsRead, 
    markAllAsRead,
    refetch: fetchNotifications 
  };
};
