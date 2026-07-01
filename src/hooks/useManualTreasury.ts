import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminDepositAddress {
  id: string;
  crypto_type: string;
  network: string;
  address: string;
  memo: string | null;
  memo_required: boolean;
  min_deposit: number;
  is_active: boolean;
  label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositRequest {
  id: string;
  user_id: string;
  crypto_type: string;
  network: string;
  amount: number;
  deposit_address: string;
  memo: string | null;
  tx_hash: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  credited_amount: number | null;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  crypto_type: string;
  network: string;
  amount: number;
  fee: number;
  total_locked: number;
  destination_address: string;
  destination_memo: string | null;
  status: "pending" | "approved" | "sent" | "rejected" | "cancelled";
  tx_hash: string | null;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export function useActiveDepositAddress(crypto: string, network: string) {
  const [address, setAddress] = useState<AdminDepositAddress | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!crypto || !network) return;
      setLoading(true);
      const { data } = await supabase
        .from("admin_deposit_addresses")
        .select("*")
        .eq("crypto_type", crypto.toUpperCase())
        .eq("network", network.toLowerCase())
        .eq("is_active", true)
        .maybeSingle();
      if (!cancelled) {
        setAddress((data as AdminDepositAddress) || null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [crypto, network]);

  return { address, loading };
}

export function useMyTreasuryRequests() {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    const [d, w] = await Promise.all([
      supabase.from("deposit_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("withdrawal_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setDeposits((d.data as DepositRequest[]) || []);
    setWithdrawals((w.data as WithdrawalRequest[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refetch(); }, [refetch]);

  return { deposits, withdrawals, loading, refetch };
}

export async function submitDepositRequest(params: {
  crypto: string; network: string; amount: number; txHash?: string; memo?: string;
}) {
  const { data, error } = await supabase.rpc("submit_deposit_request", {
    p_crypto_type: params.crypto,
    p_network: params.network,
    p_amount: params.amount,
    p_tx_hash: params.txHash || null,
    p_memo: params.memo || null,
  });
  if (error) throw error;
  return data as string;
}

export async function submitWithdrawalRequest(params: {
  crypto: string; network: string; amount: number; fee: number;
  destinationAddress: string; destinationMemo?: string;
}) {
  const { data, error } = await supabase.rpc("submit_withdrawal_request", {
    p_crypto_type: params.crypto,
    p_network: params.network,
    p_amount: params.amount,
    p_fee: params.fee,
    p_destination_address: params.destinationAddress,
    p_destination_memo: params.destinationMemo || null,
  });
  if (error) throw error;
  return data as string;
}

/* ============ Admin hooks ============ */

export function useAdminTreasuryQueue() {
  const [addresses, setAddresses] = useState<AdminDepositAddress[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<DepositRequest[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [limits, setLimits] = useState<{ crypto_type: string; daily_limit: number; notes: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const [a, d, w, l] = await Promise.all([
      supabase.from("admin_deposit_addresses").select("*").order("crypto_type"),
      supabase.from("deposit_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("withdrawal_limit_overrides").select("*").order("crypto_type"),
    ]);
    setAddresses((a.data as AdminDepositAddress[]) || []);
    setPendingDeposits((d.data as DepositRequest[]) || []);
    setPendingWithdrawals((w.data as WithdrawalRequest[]) || []);
    setLimits((l.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { addresses, pendingDeposits, pendingWithdrawals, limits, loading, refetch };
}

export async function adminApproveDeposit(id: string, creditedAmount?: number, txHash?: string, notes?: string) {
  const { error } = await supabase.rpc("admin_approve_deposit", {
    p_request_id: id,
    p_credited_amount: creditedAmount ?? null,
    p_tx_hash: txHash || null,
    p_notes: notes || null,
  });
  if (error) throw error;
}
export async function adminRejectDeposit(id: string, notes?: string) {
  const { error } = await supabase.rpc("admin_reject_deposit", { p_request_id: id, p_notes: notes || null });
  if (error) throw error;
}
export async function adminMarkWithdrawalSent(id: string, txHash: string, notes?: string) {
  const { error } = await supabase.rpc("admin_mark_withdrawal_sent", {
    p_request_id: id, p_tx_hash: txHash, p_notes: notes || null,
  });
  if (error) throw error;
}
export async function adminRejectWithdrawal(id: string, notes?: string) {
  const { error } = await supabase.rpc("admin_reject_withdrawal", { p_request_id: id, p_notes: notes || null });
  if (error) throw error;
}
