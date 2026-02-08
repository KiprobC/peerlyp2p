import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ModeratorStatus = "online" | "offline" | "busy";

export interface ModeratorAvailability {
  id: string;
  user_id: string;
  status: ModeratorStatus;
  active_cases_count: number;
  max_cases: number;
  last_assigned_at: string | null;
  updated_at: string;
}

export const useModeratorAvailability = () => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<ModeratorAvailability | null>(null);
  const [allModerators, setAllModerators] = useState<(ModeratorAvailability & { username?: string; full_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAvailability = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("moderator_availability")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setAvailability(data as ModeratorAvailability | null);
    } catch (error) {
      console.error("Error fetching availability:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchAllModerators = useCallback(async () => {
    try {
      const { data: avail, error } = await supabase
        .from("moderator_availability")
        .select("*")
        .order("active_cases_count", { ascending: true });

      if (error) throw error;

      if (avail && avail.length > 0) {
        const userIds = avail.map((a: any) => a.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, full_name")
          .in("user_id", userIds);

        const enriched = avail.map((a: any) => {
          const profile = profiles?.find((p) => p.user_id === a.user_id);
          return { ...a, username: profile?.username, full_name: profile?.full_name };
        });

        setAllModerators(enriched);
      } else {
        setAllModerators([]);
      }
    } catch (error) {
      console.error("Error fetching all moderators:", error);
    }
  }, []);

  const setStatus = async (status: ModeratorStatus) => {
    if (!user) return;

    try {
      if (availability) {
        const { error } = await supabase
          .from("moderator_availability")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("moderator_availability")
          .insert({ user_id: user.id, status });
        if (error) throw error;
      }

      await fetchAvailability();
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const updateMaxCases = async (maxCases: number) => {
    if (!user || !availability) return;
    try {
      const { error } = await supabase
        .from("moderator_availability")
        .update({ max_cases: maxCases, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
      await fetchAvailability();
    } catch (error) {
      console.error("Error updating max cases:", error);
    }
  };

  useEffect(() => {
    fetchAvailability();
    fetchAllModerators();
  }, [fetchAvailability, fetchAllModerators]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("moderator-availability-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "moderator_availability" }, () => {
        fetchAvailability();
        fetchAllModerators();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAvailability, fetchAllModerators]);

  // Auto-initialize availability record for moderators
  useEffect(() => {
    if (!loading && user && !availability) {
      supabase
        .from("moderator_availability")
        .insert({ user_id: user.id, status: "online" })
        .then(() => fetchAvailability());
    }
  }, [loading, user, availability, fetchAvailability]);

  return {
    availability,
    allModerators,
    loading,
    setStatus,
    updateMaxCases,
    refetch: fetchAvailability,
  };
};
