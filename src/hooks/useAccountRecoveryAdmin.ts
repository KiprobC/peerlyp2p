import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RecoveryDecision = "approved" | "rejected" | "more_info";

export interface RecoveryRequest {
  id: string;
  user_id: string | null;
  username: string;
  email: string;
  explanation: string;
  attachments: string[];
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  mfa_removed_at: string | null;
  mfa_removed_by: string | null;
  created_at: string;
}

export const useAccountRecoveryAdmin = () => {
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("account_recovery_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRequests((data || []) as RecoveryRequest[]);
    } catch (e) {
      console.error("Failed to load recovery requests", e);
      toast.error("Could not load recovery requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const review = useCallback(
    async (requestId: string, decision: RecoveryDecision, notes: string) => {
      setWorking(true);
      try {
        const { error } = await (supabase.rpc as any)("admin_review_recovery_request", {
          p_request_id: requestId,
          p_decision: decision,
          p_notes: notes,
        });
        if (error) throw error;
        toast.success(
          decision === "approved"
            ? "Request approved"
            : decision === "rejected"
              ? "Request rejected"
              : "More information requested",
        );
        await fetchRequests();
        return true;
      } catch (e: any) {
        toast.error(e?.message ?? "Could not save the decision");
        return false;
      } finally {
        setWorking(false);
      }
    },
    [fetchRequests],
  );

  const removeMfa = useCallback(
    async (requestId: string | null, targetUserId: string, reason: string) => {
      setWorking(true);
      try {
        const { data, error } = await supabase.functions.invoke("admin-remove-mfa", {
          body: { request_id: requestId, target_user_id: targetUserId, reason },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success("Two-factor authentication removed for this user");
        await fetchRequests();
        return true;
      } catch (e: any) {
        toast.error(e?.message ?? "Could not remove two-factor authentication");
        return false;
      } finally {
        setWorking(false);
      }
    },
    [fetchRequests],
  );

  const counts = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "pending").length,
      moreInfo: requests.filter((r) => r.status === "more_info").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    }),
    [requests],
  );

  return { requests, counts, loading, working, review, removeMfa, refetch: fetchRequests };
};

export default useAccountRecoveryAdmin;
