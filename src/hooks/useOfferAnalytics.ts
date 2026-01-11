import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyOffers, Offer } from "@/hooks/useOffers";
import { useTrades } from "@/hooks/useTrades";
import { startOfDay, subDays, format, parseISO, differenceInDays } from "date-fns";

export interface OfferAnalytics {
  offerId: string;
  offerType: "buy" | "sell";
  cryptoType: string;
  cryptoAmount: number;
  pricePerUnit: number;
  fiatCurrency: string;
  isActive: boolean;
  createdAt: string;
  
  // Trade metrics
  totalTrades: number;
  completedTrades: number;
  cancelledTrades: number;
  disputedTrades: number;
  pendingTrades: number;
  
  // Calculated metrics
  conversionRate: number;
  totalVolumeCrypto: number;
  totalVolumeFiat: number;
  avgTradeSize: number;
  avgCompletionTime: number; // in minutes
  
  // Time-based data
  tradesLast7Days: number;
  tradesLast30Days: number;
}

export interface DailyTradeData {
  date: string;
  trades: number;
  completed: number;
  volume: number;
}

export interface AnalyticsSummary {
  totalOffers: number;
  activeOffers: number;
  totalTrades: number;
  completedTrades: number;
  overallConversionRate: number;
  totalVolumeFiat: number;
  avgTradesPerOffer: number;
  bestPerformingOffer: OfferAnalytics | null;
  worstPerformingOffer: OfferAnalytics | null;
}

export const useOfferAnalytics = () => {
  const { user } = useAuth();
  const { offers, loading: offersLoading } = useMyOffers();
  const { trades, loading: tradesLoading } = useTrades();
  const [loading, setLoading] = useState(true);

  const offerAnalytics = useMemo<OfferAnalytics[]>(() => {
    if (!offers.length) return [];

    return offers.map((offer) => {
      const offerTrades = trades.filter((t) => t.offer_id === offer.id);
      
      const completedTrades = offerTrades.filter((t) => t.status === "completed");
      const cancelledTrades = offerTrades.filter((t) => t.status === "cancelled");
      const disputedTrades = offerTrades.filter((t) => t.status === "disputed");
      const pendingTrades = offerTrades.filter((t) => 
        ["pending", "confirmed", "payment_sent"].includes(t.status)
      );

      const now = new Date();
      const sevenDaysAgo = subDays(now, 7);
      const thirtyDaysAgo = subDays(now, 30);

      const tradesLast7Days = offerTrades.filter(
        (t) => new Date(t.created_at) >= sevenDaysAgo
      ).length;
      
      const tradesLast30Days = offerTrades.filter(
        (t) => new Date(t.created_at) >= thirtyDaysAgo
      ).length;

      const totalVolumeCrypto = completedTrades.reduce(
        (sum, t) => sum + t.crypto_amount,
        0
      );
      
      const totalVolumeFiat = completedTrades.reduce(
        (sum, t) => sum + t.fiat_amount,
        0
      );

      const avgTradeSize = completedTrades.length > 0 
        ? totalVolumeFiat / completedTrades.length 
        : 0;

      // Calculate average completion time in minutes
      const completionTimes = completedTrades
        .filter((t) => t.completed_at && t.created_at)
        .map((t) => {
          const start = new Date(t.created_at).getTime();
          const end = new Date(t.completed_at!).getTime();
          return (end - start) / (1000 * 60); // Convert to minutes
        });
      
      const avgCompletionTime = completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0;

      const conversionRate = offerTrades.length > 0
        ? (completedTrades.length / offerTrades.length) * 100
        : 0;

      return {
        offerId: offer.id,
        offerType: offer.type,
        cryptoType: offer.crypto_type,
        cryptoAmount: offer.crypto_amount,
        pricePerUnit: offer.price_per_unit,
        fiatCurrency: offer.fiat_currency || "KES",
        isActive: offer.is_active,
        createdAt: offer.created_at,
        totalTrades: offerTrades.length,
        completedTrades: completedTrades.length,
        cancelledTrades: cancelledTrades.length,
        disputedTrades: disputedTrades.length,
        pendingTrades: pendingTrades.length,
        conversionRate,
        totalVolumeCrypto,
        totalVolumeFiat,
        avgTradeSize,
        avgCompletionTime,
        tradesLast7Days,
        tradesLast30Days,
      };
    });
  }, [offers, trades]);

  const dailyTradeData = useMemo<DailyTradeData[]>(() => {
    const last30Days: DailyTradeData[] = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = subDays(startOfDay(now), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const nextDate = subDays(startOfDay(now), i - 1);

      const dayTrades = trades.filter((t) => {
        const tradeDate = new Date(t.created_at);
        return tradeDate >= date && tradeDate < nextDate;
      });

      const completedDayTrades = dayTrades.filter((t) => t.status === "completed");
      const volume = completedDayTrades.reduce((sum, t) => sum + t.fiat_amount, 0);

      last30Days.push({
        date: format(date, "MMM dd"),
        trades: dayTrades.length,
        completed: completedDayTrades.length,
        volume,
      });
    }

    return last30Days;
  }, [trades]);

  const summary = useMemo<AnalyticsSummary>(() => {
    const totalOffers = offerAnalytics.length;
    const activeOffers = offerAnalytics.filter((o) => o.isActive).length;
    const totalTrades = offerAnalytics.reduce((sum, o) => sum + o.totalTrades, 0);
    const completedTrades = offerAnalytics.reduce((sum, o) => sum + o.completedTrades, 0);
    const totalVolumeFiat = offerAnalytics.reduce((sum, o) => sum + o.totalVolumeFiat, 0);

    const overallConversionRate = totalTrades > 0
      ? (completedTrades / totalTrades) * 100
      : 0;

    const avgTradesPerOffer = totalOffers > 0 ? totalTrades / totalOffers : 0;

    // Sort by conversion rate * total trades to find best/worst
    const sortedByPerformance = [...offerAnalytics]
      .filter((o) => o.totalTrades > 0)
      .sort((a, b) => {
        const scoreA = a.conversionRate * Math.log(a.totalTrades + 1);
        const scoreB = b.conversionRate * Math.log(b.totalTrades + 1);
        return scoreB - scoreA;
      });

    return {
      totalOffers,
      activeOffers,
      totalTrades,
      completedTrades,
      overallConversionRate,
      totalVolumeFiat,
      avgTradesPerOffer,
      bestPerformingOffer: sortedByPerformance[0] || null,
      worstPerformingOffer: sortedByPerformance[sortedByPerformance.length - 1] || null,
    };
  }, [offerAnalytics]);

  useEffect(() => {
    if (!offersLoading && !tradesLoading) {
      setLoading(false);
    }
  }, [offersLoading, tradesLoading]);

  return {
    offerAnalytics,
    dailyTradeData,
    summary,
    loading,
  };
};
