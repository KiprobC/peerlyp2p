import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DisputeModerator {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export interface DisputeAssignment {
  id: string;
  trade_id: string;
  assigned_to: string;
  status: string;
  priority: string;
  notes: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export const useDisputeModerator = (tradeId: string, assignedModeratorId?: string | null) => {
  const [moderator, setModerator] = useState<DisputeModerator | null>(null);
  const [assignment, setAssignment] = useState<DisputeAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchModerator = useCallback(async () => {
    if (!tradeId) return;

    try {
      // Fetch assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("dispute_assignments")
        .select("*")
        .eq("trade_id", tradeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assignmentError) throw assignmentError;

      if (assignmentData) {
        setAssignment(assignmentData as DisputeAssignment);

        // Fetch moderator profile
        const { data: profileData, error: profileError } = await (supabase as any)
          .from("public_profiles")
          .select("user_id, username, full_name, avatar_url, last_seen")
          .eq("user_id", assignmentData.assigned_to)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profileData) {
          const lastSeen = profileData.last_seen
            ? new Date(profileData.last_seen)
            : null;
          const isOnline = lastSeen
            ? Date.now() - lastSeen.getTime() < 5 * 60 * 1000 // 5 minutes
            : false;

          setModerator({
            id: profileData.user_id,
            username: profileData.username,
            full_name: profileData.full_name,
            avatar_url: profileData.avatar_url,
            is_online: isOnline,
            last_seen: profileData.last_seen,
          });
        }
      } else if (assignedModeratorId) {
        // Use the direct moderator ID if no assignment found
        const { data: profileData } = await (supabase as any)
          .from("public_profiles")
          .select("user_id, username, full_name, avatar_url, last_seen")
          .eq("user_id", assignedModeratorId)
          .maybeSingle();

        if (profileData) {
          const lastSeen = profileData.last_seen
            ? new Date(profileData.last_seen)
            : null;
          const isOnline = lastSeen
            ? Date.now() - lastSeen.getTime() < 5 * 60 * 1000
            : false;

          setModerator({
            id: profileData.user_id,
            username: profileData.username,
            full_name: profileData.full_name,
            avatar_url: profileData.avatar_url,
            is_online: isOnline,
            last_seen: profileData.last_seen,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching moderator:", error);
    } finally {
      setLoading(false);
    }
  }, [tradeId, assignedModeratorId]);

  useEffect(() => {
    fetchModerator();
  }, [fetchModerator]);

  // Real-time subscription for assignment updates
  useEffect(() => {
    if (!tradeId) return;

    const channel = supabase
      .channel(`dispute-assignment-${tradeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dispute_assignments",
          filter: `trade_id=eq.${tradeId}`,
        },
        () => {
          fetchModerator();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tradeId, fetchModerator]);

  return {
    moderator,
    assignment,
    loading,
    refetch: fetchModerator,
  };
};
