import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PlatformWallet {
  id: string;
  wallet_type: string;
  crypto_type: string;
  balance: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TreasuryLedgerEntry {
  id: string;
  platform_wallet_id: string | null;
  ledger_type: string;
  amount: number;
  crypto_type: string;
  balance_before: number;
  balance_after: number;
  trade_id: string | null;
  user_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TreasuryStats {
  totalFeesCollected: Record<string, number>;
  totalEscrowHeld: Record<string, number>;
  totalRefunds: Record<string, number>;
  dailyRevenue: Record<string, number>;
  monthlyRevenue: Record<string, number>;
  allTimeRevenue: Record<string, number>;
}

export const useTreasury = () => {
  const [platformWallets, setPlatformWallets] = useState<PlatformWallet[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<TreasuryLedgerEntry[]>([]);
  const [stats, setStats] = useState<TreasuryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPlatformWallets = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_wallets")
        .select("*")
        .order("wallet_type");

      if (error) throw error;
      setPlatformWallets(data || []);
    } catch (error) {
      console.error("Error fetching platform wallets:", error);
    }
  };

  const fetchLedgerEntries = async (limit = 100) => {
    try {
      const { data, error } = await supabase
        .from("treasury_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      setLedgerEntries((data || []).map(d => ({
        ...d,
        metadata: (d.metadata as Record<string, unknown>) || null
      })));
    } catch (error) {
      console.error("Error fetching ledger entries:", error);
    }
  };

  const calculateStats = () => {
    const fees = platformWallets.filter(w => w.wallet_type === 'fees');
    const escrow = platformWallets.filter(w => w.wallet_type === 'escrow_pool');
    const refunds = platformWallets.filter(w => w.wallet_type === 'refunds');

    const totalFeesCollected: Record<string, number> = {};
    const totalEscrowHeld: Record<string, number> = {};
    const totalRefunds: Record<string, number> = {};

    fees.forEach(w => { totalFeesCollected[w.crypto_type] = Number(w.balance); });
    escrow.forEach(w => { totalEscrowHeld[w.crypto_type] = Number(w.balance); });
    refunds.forEach(w => { totalRefunds[w.crypto_type] = Number(w.balance); });

    // Calculate revenue from ledger
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyRevenue: Record<string, number> = {};
    const monthlyRevenue: Record<string, number> = {};
    const allTimeRevenue: Record<string, number> = {};

    ledgerEntries
      .filter(e => e.ledger_type === 'fee_collected')
      .forEach(entry => {
        const entryDate = new Date(entry.created_at);
        const crypto = entry.crypto_type;
        const amount = Number(entry.amount);

        allTimeRevenue[crypto] = (allTimeRevenue[crypto] || 0) + amount;
        
        if (entryDate >= startOfMonth) {
          monthlyRevenue[crypto] = (monthlyRevenue[crypto] || 0) + amount;
        }
        
        if (entryDate >= startOfDay) {
          dailyRevenue[crypto] = (dailyRevenue[crypto] || 0) + amount;
        }
      });

    setStats({
      totalFeesCollected,
      totalEscrowHeld,
      totalRefunds,
      dailyRevenue,
      monthlyRevenue,
      allTimeRevenue
    });
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchPlatformWallets(), fetchLedgerEntries()]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  useEffect(() => {
    if (platformWallets.length > 0) {
      calculateStats();
    }
  }, [platformWallets, ledgerEntries]);

  return {
    platformWallets,
    ledgerEntries,
    stats,
    loading,
    refetch: async () => {
      await Promise.all([fetchPlatformWallets(), fetchLedgerEntries()]);
    }
  };
};
