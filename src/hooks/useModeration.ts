import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface DisputeAssignment {
  id: string;
  trade_id: string;
  assigned_to: string;
  assigned_by: string;
  status: string;
  priority: string;
  notes: string | null;
  resolved_at: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  trade?: {
    id: string;
    buyer_id: string;
    seller_id: string;
    crypto_amount: number;
    crypto_type: string;
    fiat_amount: number;
    status: string;
    dispute_reason: string | null;
    disputed_at: string | null;
  };
  assignee?: {
    full_name: string | null;
    username: string | null;
  };
}

export interface AdminAction {
  id: string;
  actor_id: string;
  actor_role: string;
  action_type: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface TradeAuditTrail {
  id: string;
  trade_id: string;
  action_type: string;
  actor_id: string;
  seller_balance_before: number | null;
  seller_balance_after: number | null;
  seller_locked_before: number | null;
  seller_locked_after: number | null;
  buyer_balance_before: number | null;
  buyer_balance_after: number | null;
  escrow_amount: number | null;
  platform_fee: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Moderator {
  user_id: string;
  role: string;
  profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const useModeration = () => {
  const { user } = useAuth();
  const [disputes, setDisputes] = useState<DisputeAssignment[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [auditTrails, setAuditTrails] = useState<TradeAuditTrail[]>([]);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDisputes = async () => {
    try {
      const { data, error } = await supabase
        .from("dispute_assignments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Fetch related trade data
      if (data && data.length > 0) {
        const tradeIds = data.map(d => d.trade_id);
        const { data: trades } = await supabase
          .from("trades")
          .select("id, buyer_id, seller_id, crypto_amount, crypto_type, fiat_amount, status, dispute_reason, disputed_at")
          .in("id", tradeIds);

        const assigneeIds = [...new Set(data.map(d => d.assigned_to))];
        const { data: assignees } = await (supabase as any)
          .from("public_profiles")
          .select("user_id, full_name, username")
          .in("user_id", assigneeIds);

        const enrichedData = data.map(d => ({
          ...d,
          trade: trades?.find(t => t.id === d.trade_id),
          assignee: assignees?.find(a => a.user_id === d.assigned_to)
        }));

        setDisputes(enrichedData);
      } else {
        setDisputes([]);
      }
    } catch (error) {
      console.error("Error fetching disputes:", error);
    }
  };

  const fetchAdminActions = async (limit = 100) => {
    try {
      const { data, error } = await supabase
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      setAdminActions((data || []).map(d => ({
        ...d,
        details: (d.details as Record<string, unknown>) || null
      })));
    } catch (error) {
      console.error("Error fetching admin actions:", error);
    }
  };

  const fetchAuditTrails = async (tradeId?: string) => {
    try {
      let query = supabase
        .from("trade_audit_trail")
        .select("*")
        .order("created_at", { ascending: false });

      if (tradeId) {
        query = query.eq("trade_id", tradeId);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setAuditTrails((data || []).map(d => ({
        ...d,
        metadata: (d.metadata as Record<string, unknown>) || null
      })));
    } catch (error) {
      console.error("Error fetching audit trails:", error);
    }
  };

  const fetchModerators = async () => {
    try {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "moderator"]);

      if (error) throw error;

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, username, avatar_url")
          .in("user_id", userIds);

        const enrichedMods = roles.map(r => ({
          ...r,
          profile: profiles?.find(p => p.user_id === r.user_id)
        }));

        setModerators(enrichedMods);
      } else {
        setModerators([]);
      }
    } catch (error) {
      console.error("Error fetching moderators:", error);
    }
  };

  const assignDispute = async (tradeId: string, moderatorId: string, priority: string = 'normal', notes?: string) => {
    try {
      const { data, error } = await supabase.rpc('assign_dispute_moderator', {
        p_trade_id: tradeId,
        p_moderator_id: moderatorId,
        p_priority: priority,
        p_notes: notes || null
      });

      if (error) throw error;
      
      toast({ title: "Dispute assigned successfully" });
      await fetchDisputes();
      return true;
    } catch (error: any) {
      console.error("Error assigning dispute:", error);
      toast({ title: "Failed to assign dispute", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const resolveDispute = async (tradeId: string, resolutionType: string, notes: string) => {
    try {
      const { data, error } = await supabase.rpc('resolve_dispute', {
        p_trade_id: tradeId,
        p_resolution_type: resolutionType,
        p_resolution_notes: notes
      });

      if (error) throw error;
      
      toast({ title: "Dispute resolved successfully" });
      await fetchDisputes();
      return true;
    } catch (error: any) {
      console.error("Error resolving dispute:", error);
      toast({ title: "Failed to resolve dispute", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const updateDisputeStatus = async (disputeId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("dispute_assignments")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", disputeId);

      if (error) throw error;
      
      toast({ title: "Status updated" });
      await fetchDisputes();
      return true;
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({ title: "Failed to update status", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchDisputes(),
        fetchAdminActions(),
        fetchAuditTrails(),
        fetchModerators()
      ]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  return {
    disputes,
    adminActions,
    auditTrails,
    moderators,
    loading,
    assignDispute,
    resolveDispute,
    updateDisputeStatus,
    fetchAuditTrails,
    refetch: async () => {
      await Promise.all([fetchDisputes(), fetchAdminActions(), fetchAuditTrails()]);
    }
  };
};
