import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAdminRole = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });

        if (error) throw error;
        setIsAdmin(data || false);
      } catch (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminRole();
  }, [user]);

  return { isAdmin, loading };
};

export interface AdminUser {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  kyc_status: "pending" | "submitted" | "verified" | "rejected";
  is_verified: boolean;
  total_trades: number;
  successful_trades: number;
  rating: number;
  created_at: string;
}

export interface AdminTrade {
  id: string;
  buyer_id: string;
  seller_id: string;
  crypto_type: string;
  crypto_amount: number;
  fiat_amount: number;
  fiat_currency: string;
  status: string;
  dispute_reason: string | null;
  disputed_by: string | null;
  disputed_at: string | null;
  created_at: string;
}

export interface PlatformStats {
  totalUsers: number;
  verifiedUsers: number;
  totalTrades: number;
  completedTrades: number;
  disputedTrades: number;
  totalVolume: number;
  activeOffers: number;
}

export const useAdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserKYC = async (userId: string, status: "pending" | "submitted" | "verified" | "rejected") => {
    try {
      const updates: Record<string, unknown> = { kyc_status: status };
      if (status === "verified") {
        updates.is_verified = true;
        updates.kyc_verified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);

      if (error) throw error;
      await fetchUsers();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return { users, loading, updateUserKYC, refetch: fetchUsers };
};

export const useAdminTrades = () => {
  const [trades, setTrades] = useState<AdminTrade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    try {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error("Error fetching trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const disputedTrades = trades.filter((t) => t.status === "disputed");

  const resolveTrade = async (tradeId: string, resolution: "completed" | "cancelled") => {
    try {
      const updates: Record<string, unknown> = {
        status: resolution,
      };
      if (resolution === "completed") {
        updates.completed_at = new Date().toISOString();
        updates.escrow_released = true;
      } else {
        updates.cancelled_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("trades")
        .update(updates)
        .eq("id", tradeId);

      if (error) throw error;
      await fetchTrades();
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  return { trades, disputedTrades, loading, resolveTrade, refetch: fetchTrades };
};

export const usePlatformStats = () => {
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    verifiedUsers: 0,
    totalTrades: 0,
    completedTrades: 0,
    disputedTrades: 0,
    totalVolume: 0,
    activeOffers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch users stats
        const { data: usersData } = await supabase.from("profiles").select("is_verified");
        const totalUsers = usersData?.length || 0;
        const verifiedUsers = usersData?.filter((u) => u.is_verified).length || 0;

        // Fetch trades stats
        const { data: tradesData } = await supabase.from("trades").select("status, fiat_amount");
        const totalTrades = tradesData?.length || 0;
        const completedTrades = tradesData?.filter((t) => t.status === "completed").length || 0;
        const disputedTrades = tradesData?.filter((t) => t.status === "disputed").length || 0;
        const totalVolume = tradesData?.reduce((sum, t) => sum + Number(t.fiat_amount), 0) || 0;

        // Fetch offers stats
        const { data: offersData } = await supabase.from("offers").select("is_active");
        const activeOffers = offersData?.filter((o) => o.is_active).length || 0;

        setStats({
          totalUsers,
          verifiedUsers,
          totalTrades,
          completedTrades,
          disputedTrades,
          totalVolume,
          activeOffers,
        });
      } catch (error) {
        console.error("Error fetching platform stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading };
};
