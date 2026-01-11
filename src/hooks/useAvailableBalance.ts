import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

export interface AvailableBalance {
  crypto_type: string;
  total_balance: number;
  locked_balance: number;
  reserved_balance: number;
  available_balance: number;
}

export const useAvailableBalance = (cryptoType?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [balances, setBalances] = useState<Record<string, AvailableBalance>>({});
  const [loading, setLoading] = useState(true);

  const fetchAvailableBalance = useCallback(async (crypto?: string) => {
    if (!user) {
      setBalances({});
      setLoading(false);
      return;
    }

    try {
      const cryptoTypes = crypto ? [crypto.toUpperCase()] : ["BTC", "ETH", "USDT"];
      const newBalances: Record<string, AvailableBalance> = {};

      for (const ct of cryptoTypes) {
        // Get available balance using RPC (type assertion since function is newly created)
        const { data: availableBalance, error: rpcError } = await (supabase
          .rpc as any)("get_available_balance", {
            p_user_id: user.id,
            p_crypto_type: ct,
          });

        if (rpcError) {
          console.error(`Error fetching available balance for ${ct}:`, rpcError);
          continue;
        }

        // Get wallet details for full breakdown
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance, locked_balance")
          .eq("user_id", user.id)
          .eq("crypto_type", ct)
          .maybeSingle();

        // Get reserved in offers
        const { data: reservedData } = await supabase
          .from("offers")
          .select("*")
          .eq("user_id", user.id)
          .eq("crypto_type", ct)
          .eq("type", "sell")
          .eq("is_active", true);

        const totalReserved = reservedData?.reduce((sum, o: any) => sum + (Number(o.reserved_amount) || 0), 0) || 0;

        newBalances[ct] = {
          crypto_type: ct,
          total_balance: Number(wallet?.balance) || 0,
          locked_balance: Number(wallet?.locked_balance) || 0,
          reserved_balance: totalReserved,
          available_balance: Number(availableBalance) || 0,
        };
      }

      setBalances(newBalances);
    } catch (error) {
      console.error("Error fetching available balances:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAvailableBalance(cryptoType);
  }, [user, cryptoType, fetchAvailableBalance]);

  // Real-time subscription for wallet and offer changes
  useEffect(() => {
    if (!user) return;

    const walletChannel = supabase
      .channel(`balance-wallets-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchAvailableBalance(cryptoType);
        }
      )
      .subscribe();

    const offerChannel = supabase
      .channel(`balance-offers-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "offers",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchAvailableBalance(cryptoType);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(offerChannel);
    };
  }, [user, cryptoType, fetchAvailableBalance]);

  const getAvailableBalance = (crypto: string): number => {
    return balances[crypto.toUpperCase()]?.available_balance || 0;
  };

  const getBalanceDetails = (crypto: string): AvailableBalance | null => {
    return balances[crypto.toUpperCase()] || null;
  };

  return {
    balances,
    loading,
    refetch: () => fetchAvailableBalance(cryptoType),
    getAvailableBalance,
    getBalanceDetails,
  };
};
