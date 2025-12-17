import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ONLINE_THRESHOLD_MINUTES = 5;

export const useOnlineStatus = () => {
  const { user } = useAuth();

  const updateLastSeen = useCallback(async () => {
    if (!user) return;
    
    try {
      await supabase.rpc("update_last_seen");
    } catch (error) {
      console.error("Error updating last seen:", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Update immediately on mount
    updateLastSeen();

    // Update every 2 minutes
    const interval = setInterval(updateLastSeen, 2 * 60 * 1000);

    // Update on user activity
    const handleActivity = () => updateLastSeen();
    
    window.addEventListener("click", handleActivity, { passive: true });
    window.addEventListener("keypress", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });

    return () => {
      clearInterval(interval);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keypress", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [user, updateLastSeen]);
};

export const isUserOnline = (lastSeen: string | null): boolean => {
  if (!lastSeen) return false;
  
  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
  
  return diffMinutes <= ONLINE_THRESHOLD_MINUTES;
};

export const getOnlineStatusColor = (lastSeen: string | null): string => {
  return isUserOnline(lastSeen) ? "bg-amber-400" : "bg-muted-foreground/50";
};
