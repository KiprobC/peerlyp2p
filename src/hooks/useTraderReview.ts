import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * One review per reviewer/trader relationship.
 * Server-enforced by a unique index on (rater_id, rated_id); this hook is the
 * frontend read of that same truth via a security-definer RPC.
 */
export const useTraderReview = (ratedUserId?: string | null) => {
  const { user } = useAuth();
  const [hasReviewed, setHasReviewed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!user || !ratedUserId) {
      setHasReviewed(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("has_reviewed_trader", {
        p_rated_id: ratedUserId,
      });
      if (error) throw error;
      setHasReviewed(Boolean(data));
    } catch (e) {
      console.error("Error checking existing trader review:", e);
      // Fail closed: never prompt if we cannot verify.
      setHasReviewed(true);
    } finally {
      setLoading(false);
    }
  }, [user, ratedUserId]);

  useEffect(() => {
    check();
  }, [check]);

  return { hasReviewed, loading, refetch: check };
};
