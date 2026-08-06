import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdminPendingCounts {
  kyc: number;
  disputes: number;
  deposits: number;
  withdrawals: number;
  recovery: number;
  support: number;
  risk: number;
}

const EMPTY: AdminPendingCounts = {
  kyc: 0,
  disputes: 0,
  deposits: 0,
  withdrawals: 0,
  recovery: 0,
  support: 0,
  risk: 0,
};

/**
 * Live pending-work counters for the admin sidebar badges.
 * Refreshes on realtime changes to any queue table, plus a 20s poll fallback.
 */
export const useAdminPendingCounts = () => {
  const [counts, setCounts] = useState<AdminPendingCounts>(EMPTY);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)("admin_pending_counts");
    if (!error && data) {
      setCounts({ ...EMPTY, ...(data as Partial<AdminPendingCounts>) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    timer.current = setInterval(refresh, 20_000);

    const channel = supabase
      .channel("admin-pending-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_recovery_requests" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, refresh)
      .subscribe();

    return () => {
      if (timer.current) clearInterval(timer.current);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { counts, loading, refresh };
};
