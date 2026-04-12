import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that provides real-time admin dashboard stats via
 * Supabase realtime subscriptions + polling fallback (every 10s).
 */
export interface RealtimeAdminStats {
  totalUsers: number;
  activeTrades: number;
  pendingDisputes: number;
  escrowLocked: number;
  tradingVolume24h: number;
  failedTransactions: number;
  pendingKYC: number;
}

export const useAdminRealtime = () => {
  const [stats, setStats] = useState<RealtimeAdminStats>({
    totalUsers: 0,
    activeTrades: 0,
    pendingDisputes: 0,
    escrowLocked: 0,
    tradingVolume24h: 0,
    failedTransactions: 0,
    pendingKYC: 0,
  });
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [usersRes, tradesRes, walletsRes, txRes, kycRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("trades").select("status, fiat_amount, created_at"),
        supabase.from("wallets").select("locked_balance"),
        supabase.from("wallet_transactions").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "submitted"),
      ]);

      const trades = tradesRes.data || [];
      const activeTrades = trades.filter(t =>
        ["pending", "confirmed", "payment_sent"].includes(t.status || "")
      ).length;
      const pendingDisputes = trades.filter(t => t.status === "disputed").length;
      const tradingVolume24h = trades
        .filter(t => t.created_at >= dayAgo)
        .reduce((sum, t) => sum + Number(t.fiat_amount), 0);

      const escrowLocked = (walletsRes.data || []).reduce(
        (sum, w) => sum + Number(w.locked_balance), 0
      );

      setStats({
        totalUsers: usersRes.count || 0,
        activeTrades,
        pendingDisputes,
        escrowLocked,
        tradingVolume24h,
        failedTransactions: txRes.count || 0,
        pendingKYC: kycRes.count || 0,
      });
    } catch (err) {
      console.error("Error fetching realtime admin stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Poll every 10 seconds
    intervalRef.current = setInterval(fetchStats, 10_000);

    // Also subscribe to key table changes for instant updates
    const channel = supabase
      .channel("admin-realtime-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, fetchStats)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, fetchStats)
      .subscribe();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
};
