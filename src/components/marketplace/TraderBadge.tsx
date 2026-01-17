import { calculateTraderTier, getTierTooltip, TraderTierInfo } from "@/lib/traderTiers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TraderBadgeProps {
  totalTrades: number;
  successfulTrades?: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const TraderBadge = ({
  totalTrades,
  successfulTrades,
  size = "sm",
  showLabel = false,
  className,
}: TraderBadgeProps) => {
  const tier = calculateTraderTier(totalTrades, successfulTrades ?? totalTrades);
  
  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-0.5",
    md: "text-xs px-2 py-1 gap-1",
    lg: "text-sm px-2.5 py-1.5 gap-1.5",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center font-medium rounded-full border transition-colors cursor-help",
              tier.bgColor,
              tier.color,
              tier.borderColor,
              sizeClasses[size],
              className
            )}
          >
            <span>{tier.icon}</span>
            {showLabel && <span>{tier.label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-center">
          <p className="text-xs">{getTierTooltip(tier)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TraderBadge;
