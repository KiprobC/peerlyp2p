import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface RiskEvent {
  id: string;
  user_id: string;
  action_type: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  decision: string;
  reasons: string[];
  created_at: string;
}

export interface AccountFreeze {
  id: string;
  user_id: string;
  scope: "withdrawals" | "trading" | "account";
  reason: string | null;
  frozen_by: string;
  frozen_at: string;
  is_active: boolean;
}

export const useRiskEvents = (level?: string, limit = 100) => {
  return useQuery({
    queryKey: ["risk-events", level, limit],
    queryFn: async () => {
      let q = supabase
        .from("risk_events" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (level) q = q.eq("risk_level", level);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RiskEvent[];
    },
  });
};

export const useAccountFreezes = () => {
  return useQuery({
    queryKey: ["account-freezes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_freezes" as any)
        .select("*")
        .eq("is_active", true)
        .order("frozen_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AccountFreeze[];
    },
  });
};

export const useFreezeUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; scope: "withdrawals" | "trading" | "account"; reason?: string }) => {
      const { data, error } = await supabase.rpc("freeze_user_scoped" as any, {
        p_user_id: vars.userId,
        p_scope: vars.scope,
        p_reason: vars.reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "User frozen" });
      qc.invalidateQueries({ queryKey: ["account-freezes"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
};

export const useUnfreezeUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { userId: string; scope: "withdrawals" | "trading" | "account"; reason?: string }) => {
      const { error } = await supabase.rpc("unfreeze_user_scoped" as any, {
        p_user_id: vars.userId,
        p_scope: vars.scope,
        p_reason: vars.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "User unfrozen" });
      qc.invalidateQueries({ queryKey: ["account-freezes"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
};
