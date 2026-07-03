import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCryptoPrices, USD_TO_KES } from "@/hooks/useCryptoPrices";
import type { Wallet } from "@/hooks/useWallets";

/**
 * Single source of truth for a user's portfolio.
 *
 * ALL screens (Home / Wallet / Profile / Marketplace headers / etc.) must read
 * from this hook — never recompute totals from raw wallets + prices locally.
 * That's what caused the KES-vs-USD-vs-stale-hardcoded-price drift.
 *
 * Responsibilities:
 *   - Fetch wallets (react-query, cached under ["portfolio-wallets", userId]).
 *   - Fetch live crypto prices via useCryptoPrices (already cached & refetched).
 *   - Convert to the requested display currency using the same conversion table.
 *   - Compute per-asset values ONCE, and total = SUM(per-asset). This
 *     guarantees "Total = sum of parts" exactly.
 *   - Refetch every 30s + on window focus + on realtime wallet/offer changes.
 */

export type DisplayCurrency = "USD" | "KES" | "EUR" | "GBP";

export interface PortfolioAsset {
  crypto_type: string;
  balance: number;         // Total balance in DB
  locked_balance: number;  // Locked (pending withdrawals, escrow, etc.)
  priceUSD: number;
  priceInCurrency: number;
  valueInCurrency: number; // balance * priceInCurrency
}

export interface Portfolio {
  currency: DisplayCurrency;
  currencySymbol: string;
  assets: PortfolioAsset[];
  totalValue: number;       // Exact sum of assets[i].valueInCurrency
  lastUpdated: Date | null;
  loading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  USD: "$",
  KES: "KES ",
  EUR: "€",
  GBP: "£",
};

// Central conversion table. Extend here when adding currencies — never inline.
const getConversionRate = (currency: DisplayCurrency): number => {
  switch (currency) {
    case "KES":
      return USD_TO_KES;
    case "USD":
    case "EUR": // approximate parity for now, keep single source of truth
    case "GBP":
    default:
      return 1;
  }
};

const fetchWallets = async (userId: string): Promise<Wallet[]> => {
  const { data, error } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data as Wallet[]) || [];
};

export const usePortfolio = (currency: DisplayCurrency = "KES"): Portfolio => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const walletsQuery = useQuery({
    queryKey: ["portfolio-wallets", user?.id],
    queryFn: () => fetchWallets(user!.id),
    enabled: !!user,
    staleTime: 10_000,
    refetchInterval: 30_000,        // Requirement: refresh every 30s
    refetchOnWindowFocus: true,     // Requirement: refresh on focus
    refetchIntervalInBackground: false,
  });

  const {
    prices,
    loading: pricesLoading,
    lastUpdated,
    refetch: refetchPrices,
  } = useCryptoPrices("USD");

  // Realtime: any wallet or offer change → invalidate portfolio.
  useEffect(() => {
    if (!user) return;
    const walletCh = supabase
      .channel(`portfolio-wallets-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["portfolio-wallets", user.id] });
          queryClient.invalidateQueries({ queryKey: ["available-balance"] });
        }
      )
      .subscribe();
    const offerCh = supabase
      .channel(`portfolio-offers-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["portfolio-wallets", user.id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(walletCh);
      supabase.removeChannel(offerCh);
    };
  }, [user, queryClient]);

  const portfolio = useMemo<Omit<Portfolio, "refetch">>(() => {
    const rate = getConversionRate(currency);
    const wallets = walletsQuery.data || [];

    const assets: PortfolioAsset[] = wallets.map((w) => {
      const priceUSD = prices[w.crypto_type] || 0;
      const priceInCurrency = priceUSD * rate;
      const valueInCurrency = Number(w.balance) * priceInCurrency;
      return {
        crypto_type: w.crypto_type,
        balance: Number(w.balance) || 0,
        locked_balance: Number(w.locked_balance) || 0,
        priceUSD,
        priceInCurrency,
        valueInCurrency,
      };
    });

    // Total is EXACTLY the sum of the per-asset values shown to the user.
    const totalValue = assets.reduce((sum, a) => sum + a.valueInCurrency, 0);

    return {
      currency,
      currencySymbol: CURRENCY_SYMBOLS[currency] || currency + " ",
      assets,
      totalValue,
      lastUpdated,
      loading: walletsQuery.isLoading || pricesLoading,
      isFetching: walletsQuery.isFetching,
    };
  }, [walletsQuery.data, walletsQuery.isLoading, walletsQuery.isFetching, prices, pricesLoading, lastUpdated, currency]);

  const refetch = async () => {
    await Promise.all([walletsQuery.refetch(), refetchPrices()]);
  };

  return { ...portfolio, refetch };
};

/**
 * Helper: format a numeric value using the portfolio's currency symbol.
 * Kept here so every screen formats totals identically.
 */
export const formatPortfolioValue = (
  value: number,
  currency: DisplayCurrency,
  fractionDigits = 2
): string => {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + " ";
  return `${symbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
};
