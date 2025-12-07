import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Wallet {
  id: string;
  user_id: string;
  crypto_type: string;
  balance: number;
  locked_balance: number;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: "deposit" | "withdrawal" | "escrow_lock" | "escrow_release" | "trade";
  amount: number;
  fee: number;
  crypto_type: string;
  status: string;
  reference: string | null;
  mpesa_receipt: string | null;
  trade_id: string | null;
  description: string | null;
  created_at: string;
}

// Crypto info for display
export const cryptoInfo: Record<string, { name: string; icon: string; color: string }> = {
  BTC: { name: "Bitcoin", icon: "₿", color: "#F7931A" },
  USDT: { name: "Tether", icon: "₮", color: "#26A17B" },
  ETH: { name: "Ethereum", icon: "Ξ", color: "#627EEA" },
};

export const useWallets = () => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWallets = async () => {
    if (!user) {
      setWallets([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      setWallets(data || []);
    } catch (error) {
      console.error("Error fetching wallets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  useEffect(() => {
    fetchWallets();
    fetchTransactions();
  }, [user]);

  const getTotalValue = (priceMap: Record<string, number>) => {
    return wallets.reduce((total, wallet) => {
      const price = priceMap[wallet.crypto_type] || 0;
      return total + (wallet.balance * price);
    }, 0);
  };

  return { 
    wallets, 
    transactions, 
    loading, 
    refetch: fetchWallets,
    refetchTransactions: fetchTransactions,
    getTotalValue 
  };
};
