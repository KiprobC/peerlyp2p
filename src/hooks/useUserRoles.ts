import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "moderator" | "user";

export interface UserWithRole {
  user_id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: AppRole;
  kyc_status: string;
  is_verified: boolean;
  total_trades: number;
  successful_trades: number;
  success_rate: number;
  rating: number;
  created_at: string;
  days_on_platform: number;
}

export const useUserRoles = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsersWithRoles = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, username, full_name, avatar_url, kyc_status, is_verified, rating, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch trades to calculate stats
      const { data: trades, error: tradesError } = await supabase
        .from("trades")
        .select("buyer_id, seller_id, status");

      if (tradesError) throw tradesError;

      // Calculate trade stats per user (only resolved trades for success rate)
      const userTradeStats = new Map<string, { total: number; completed: number; cancelled: number }>();
      trades?.forEach((trade) => {
        [trade.buyer_id, trade.seller_id].forEach((userId) => {
          const stats = userTradeStats.get(userId) || { total: 0, completed: 0, cancelled: 0 };
          stats.total += 1;
          if (trade.status === "completed") stats.completed += 1;
          if (trade.status === "cancelled") stats.cancelled += 1;
          userTradeStats.set(userId, stats);
        });
      });

      // Build role map
      const roleMap = new Map<string, AppRole>();
      roles?.forEach((r) => {
        roleMap.set(r.user_id, r.role as AppRole);
      });

      // Merge data
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const stats = userTradeStats.get(profile.user_id) || { total: 0, completed: 0, cancelled: 0 };
        const role = roleMap.get(profile.user_id) || "user";
        const createdAt = new Date(profile.created_at);
        const now = new Date();
        const daysOnPlatform = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        return {
          user_id: profile.user_id,
          username: profile.username,
          full_name: profile.full_name,
          email: null, // Not exposed from profiles
          avatar_url: profile.avatar_url,
          role,
          kyc_status: profile.kyc_status || "pending",
          is_verified: profile.is_verified || false,
          total_trades: stats.total,
          successful_trades: stats.completed,
          success_rate: (() => {
            const resolved = stats.completed + stats.cancelled;
            return resolved > 0 ? Math.round((stats.completed / resolved) * 100) : 0;
          })(),
          rating: profile.rating || 0,
          created_at: profile.created_at,
          days_on_platform: daysOnPlatform,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users with roles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const assignRole = async (userId: string, role: AppRole) => {
    try {
      if (role === "user") {
        // Remove from user_roles table (default is user)
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Upsert role
        const { error } = await supabase
          .from("user_roles")
          .upsert(
            { user_id: userId, role },
            { onConflict: "user_id,role" }
          );

        if (error) {
          // If upsert fails due to unique constraint, try delete then insert
          await supabase.from("user_roles").delete().eq("user_id", userId);
          const { error: insertError } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role });
          if (insertError) throw insertError;
        }
      }

      await fetchUsersWithRoles();
      return { error: null };
    } catch (error) {
      console.error("Error assigning role:", error);
      return { error };
    }
  };

  const removeRole = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
      await fetchUsersWithRoles();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchUsersWithRoles();
  }, [fetchUsersWithRoles]);

  // Filter helpers
  const admins = users.filter((u) => u.role === "admin");
  const moderators = users.filter((u) => u.role === "moderator");
  const regularUsers = users.filter((u) => u.role === "user");

  // Get suitable moderator candidates (verified, good stats)
  const getModeratorCandidates = (minTrades = 5, minDays = 30, minSuccessRate = 80) => {
    return users.filter(
      (u) =>
        u.role === "user" &&
        u.is_verified &&
        u.total_trades >= minTrades &&
        u.days_on_platform >= minDays &&
        u.success_rate >= minSuccessRate
    );
  };

  return {
    users,
    admins,
    moderators,
    regularUsers,
    loading,
    assignRole,
    removeRole,
    getModeratorCandidates,
    refetch: fetchUsersWithRoles,
  };
};
