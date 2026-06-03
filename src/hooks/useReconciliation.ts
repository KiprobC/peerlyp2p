import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ReconciliationRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  total_drift: number;
  triggered_by: string;
  notes: string | null;
}

export interface ReconciliationResult {
  id: string;
  run_id: string;
  crypto_type: string;
  user_wallet_balance: number;
  user_locked_balance: number;
  reserved_in_offers: number;
  platform_wallet_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_fees_collected: number;
  expected_total: number;
  actual_total: number;
  drift: number;
  status: string;
  created_at: string;
}

export const useReconciliation = () => {
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [results, setResults] = useState<ReconciliationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: runsData } = await (supabase as any)
      .from("reconciliation_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(30);
    const { data: resultsData } = await (supabase as any)
      .from("reconciliation_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setRuns(runsData || []);
    setResults(resultsData || []);
    setLoading(false);
  }, []);

  const runNow = useCallback(async () => {
    setRunning(true);
    try {
      const { data, error } = await (supabase as any).rpc("admin_run_reconciliation");
      if (error) throw error;
      toast({ title: "Reconciliation complete", description: `Run: ${data}` });
      await fetch();
    } catch (e: any) {
      toast({ title: "Reconciliation failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }, [fetch]);

  useEffect(() => { fetch(); }, [fetch]);

  return { runs, results, loading, running, runNow, refetch: fetch };
};
