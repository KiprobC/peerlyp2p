import { Link } from "react-router-dom";
import { AlertTriangle, Shield, ChevronRight, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserKYCTier, useUserTierLimits, useUserTradingStats, getTierInfo, formatLimit } from "@/hooks/useKYCLimits";
import { cn } from "@/lib/utils";

interface KYCLimitBannerProps {
  compact?: boolean;
  showProgress?: boolean;
  className?: string;
}

export function KYCLimitBanner({ compact = false, showProgress = true, className }: KYCLimitBannerProps) {
  const { data: tier, isLoading: tierLoading } = useUserKYCTier();
  const limits = useUserTierLimits();
  const { data: stats } = useUserTradingStats();

  if (tierLoading || !tier) return null;

  const tierInfo = getTierInfo(tier);
  const isUnverified = tier === "unverified";
  const needsUpgrade = tier !== "level_3";

  // Calculate usage percentages
  const dailyUsagePercent = stats && limits 
    ? Math.min((stats.daily_trade_volume / limits.daily_trade_limit) * 100, 100) 
    : 0;
  const monthlyUsagePercent = stats && limits 
    ? Math.min((stats.monthly_trade_volume / limits.monthly_trade_limit) * 100, 100) 
    : 0;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-xs", className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/50", tierInfo.color)}>
                <span>{tierInfo.icon}</span>
                <span className="font-medium">{tierInfo.label}</span>
                <Info className="w-3 h-3 opacity-60" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="space-y-1 text-xs">
                <p className="font-medium">Your KYC Limits</p>
                {limits && (
                  <>
                    <p>Max per trade: {formatLimit(limits.max_single_trade_amount)}</p>
                    <p>Daily limit: {formatLimit(limits.daily_trade_limit)}</p>
                    <p>Monthly limit: {formatLimit(limits.monthly_trade_limit)}</p>
                  </>
                )}
                {needsUpgrade && (
                  <p className="text-primary">Complete verification for higher limits</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  if (isUnverified) {
    return (
      <Alert variant="destructive" className={cn("border-destructive/50 bg-destructive/10", className)}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
          <span>
            <strong>Verification Required</strong> — Complete verification to start trading on the platform.
          </span>
          <Button asChild size="sm" variant="outline" className="gap-1 border-destructive/50 hover:bg-destructive/20">
            <Link to="/kyc-upload">
              <Shield className="w-3 h-3" />
              Verify Now
              <ChevronRight className="w-3 h-3" />
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("p-3 rounded-lg bg-secondary/30 border border-border/50", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", tierInfo.color)}>
            {tierInfo.icon} {tierInfo.label}
          </span>
          {limits && (
            <span className="text-xs text-muted-foreground">
              Max {formatLimit(limits.max_single_trade_amount)} per trade
            </span>
          )}
        </div>
        {needsUpgrade && (
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
            <Link to="/kyc-upload">
              Upgrade Limits
              <ChevronRight className="w-3 h-3" />
            </Link>
          </Button>
        )}
      </div>

      {showProgress && limits && stats && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Daily</span>
              <span>{formatLimit(stats.daily_trade_volume)} / {formatLimit(limits.daily_trade_limit)}</span>
            </div>
            <Progress 
              value={dailyUsagePercent} 
              className="h-1.5" 
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Monthly</span>
              <span>{formatLimit(stats.monthly_trade_volume)} / {formatLimit(limits.monthly_trade_limit)}</span>
            </div>
            <Progress 
              value={monthlyUsagePercent} 
              className="h-1.5" 
            />
          </div>
        </div>
      )}
    </div>
  );
}