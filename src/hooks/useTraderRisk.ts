import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TraderRiskData {
  risk_score: number;
  risk_level: string;
  total_trades: number;
  completed_trades: number;
  cancelled_trades: number;
  disputes_raised_against: number;
  average_release_time_minutes: number | null;
}

export const useTraderRisk = (userId: string | undefined) => {
  const [riskData, setRiskData] = useState<TraderRiskData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("trader_behavior_metrics" as any)
        .select("risk_score, risk_level, total_trades, completed_trades, cancelled_trades, disputes_raised_against, average_release_time_minutes")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setRiskData(data as any);
      }
      setLoading(false);
    };

    fetch();
  }, [userId]);

  return { riskData, loading };
};
