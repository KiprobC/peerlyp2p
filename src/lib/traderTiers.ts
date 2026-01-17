// Trader tier system based on real trade metrics
export type TraderTier = "bronze" | "silver" | "gold" | "pro";

export interface TraderTierInfo {
  tier: TraderTier;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  minTrades: number;
  minCompletionRate: number;
}

export const TRADER_TIERS: Record<TraderTier, TraderTierInfo> = {
  bronze: {
    tier: "bronze",
    label: "Bronze",
    color: "text-amber-700 dark:text-amber-600",
    bgColor: "bg-amber-100/80 dark:bg-amber-900/30",
    borderColor: "border-amber-300 dark:border-amber-700",
    icon: "🥉",
    minTrades: 0,
    minCompletionRate: 0,
  },
  silver: {
    tier: "silver",
    label: "Silver",
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100/80 dark:bg-slate-800/50",
    borderColor: "border-slate-300 dark:border-slate-600",
    icon: "🥈",
    minTrades: 10,
    minCompletionRate: 80,
  },
  gold: {
    tier: "gold",
    label: "Gold",
    color: "text-yellow-600 dark:text-yellow-500",
    bgColor: "bg-yellow-100/80 dark:bg-yellow-900/30",
    borderColor: "border-yellow-400 dark:border-yellow-600",
    icon: "🥇",
    minTrades: 50,
    minCompletionRate: 90,
  },
  pro: {
    tier: "pro",
    label: "Merchant",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/50",
    icon: "💎",
    minTrades: 200,
    minCompletionRate: 95,
  },
};

export function calculateTraderTier(
  totalTrades: number,
  successfulTrades: number
): TraderTierInfo {
  const completionRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

  // Check from highest to lowest tier
  if (totalTrades >= TRADER_TIERS.pro.minTrades && completionRate >= TRADER_TIERS.pro.minCompletionRate) {
    return TRADER_TIERS.pro;
  }
  if (totalTrades >= TRADER_TIERS.gold.minTrades && completionRate >= TRADER_TIERS.gold.minCompletionRate) {
    return TRADER_TIERS.gold;
  }
  if (totalTrades >= TRADER_TIERS.silver.minTrades && completionRate >= TRADER_TIERS.silver.minCompletionRate) {
    return TRADER_TIERS.silver;
  }
  return TRADER_TIERS.bronze;
}

export function getTierTooltip(tier: TraderTierInfo): string {
  if (tier.tier === "bronze") {
    return "New trader - Complete 10+ trades with 80%+ success rate to reach Silver";
  }
  if (tier.tier === "silver") {
    return "Silver trader - 10+ trades with 80%+ completion rate";
  }
  if (tier.tier === "gold") {
    return "Gold trader - 50+ trades with 90%+ completion rate";
  }
  return "Verified Merchant - 200+ trades with 95%+ completion rate";
}
