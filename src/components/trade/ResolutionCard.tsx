import { 
  CheckCircle, 
  XCircle, 
  Scale, 
  ArrowRight,
  User,
  Coins
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ResolutionCardProps {
  resolutionType: "buyer_wins" | "seller_wins" | "split" | "cancelled";
  resolutionSummary: string;
  resolvedAt: string;
  moderatorName?: string;
  cryptoAmount: number;
  cryptoType: string;
}

const resolutionConfig = {
  buyer_wins: {
    label: "Buyer Awarded",
    icon: User,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    description: "Crypto released to buyer",
  },
  seller_wins: {
    label: "Seller Refunded",
    icon: User,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    description: "Escrow returned to seller",
  },
  split: {
    label: "Split Decision",
    icon: Scale,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    description: "Funds split between parties",
  },
  cancelled: {
    label: "Trade Cancelled",
    icon: XCircle,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
    description: "Trade voided",
  },
};

export const ResolutionCard = ({
  resolutionType,
  resolutionSummary,
  resolvedAt,
  moderatorName,
  cryptoAmount,
  cryptoType,
}: ResolutionCardProps) => {
  const config = resolutionConfig[resolutionType] || resolutionConfig.cancelled;
  const Icon = config.icon;

  return (
    <Card className={cn("border-2", config.borderColor)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-full", config.bgColor)}>
              <Scale className={cn("w-5 h-5", config.color)} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Dispute Resolved</h3>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(resolvedAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={cn("text-xs gap-1", config.color, config.borderColor)}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </Badge>
        </div>

        {/* Outcome */}
        <div className={cn("rounded-lg p-3 mb-3", config.bgColor)}>
          <div className="flex items-center gap-2 mb-2">
            <Coins className={cn("w-4 h-4", config.color)} />
            <span className="text-sm font-medium">
              {cryptoAmount} {cryptoType}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{config.description}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Resolution Summary
          </p>
          <p className="text-sm leading-relaxed">{resolutionSummary}</p>
        </div>

        {/* Moderator */}
        {moderatorName && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">
              Resolved by <span className="font-medium text-foreground">{moderatorName}</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
