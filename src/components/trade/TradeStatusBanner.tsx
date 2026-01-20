import { CheckCircle, XCircle, AlertTriangle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TradeStatusBannerProps {
  status: string;
  hasRated: boolean;
  onRate: () => void;
}

export const TradeStatusBanner = ({ status, hasRated, onRate }: TradeStatusBannerProps) => {
  if (!["completed", "cancelled", "disputed"].includes(status)) {
    return null;
  }

  const configs = {
    completed: {
      icon: CheckCircle,
      label: "Trade Completed",
      bgColor: "bg-green-500/10",
      textColor: "text-green-500",
      borderColor: "border-green-500/20",
    },
    cancelled: {
      icon: XCircle,
      label: "Trade Cancelled",
      bgColor: "bg-muted",
      textColor: "text-muted-foreground",
      borderColor: "border-border",
    },
    disputed: {
      icon: AlertTriangle,
      label: "Under Review",
      bgColor: "bg-orange-500/10",
      textColor: "text-orange-500",
      borderColor: "border-orange-500/20",
    },
  };
  
  const config = configs[status as keyof typeof configs] || configs.cancelled;

  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center justify-center gap-3 px-4 py-3 border-t",
      config.bgColor,
      config.borderColor
    )}>
      <div className={cn("flex items-center gap-2", config.textColor)}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
      
      {status === "completed" && !hasRated && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRate}
          className="h-7 text-xs gap-1.5"
        >
          <Star className="w-3 h-3" />
          Rate Trade
        </Button>
      )}
    </div>
  );
};
