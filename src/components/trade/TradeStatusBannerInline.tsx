import { Clock, CheckCircle, AlertTriangle, Loader2, Shield, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradeStatusBannerInlineProps {
  status: string;
  isBuyer: boolean;
  isSeller: boolean;
  escrowLocked: boolean;
}

const statusConfigs: Record<string, {
  buyerLabel: string;
  sellerLabel: string;
  icon: typeof Clock;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  pending: {
    buyerLabel: "Waiting for seller to lock escrow",
    sellerLabel: "Lock escrow to begin trade",
    icon: Clock,
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-500",
    borderColor: "border-amber-500/20",
  },
  confirmed: {
    buyerLabel: "Escrow locked. Send payment now",
    sellerLabel: "Waiting for buyer payment",
    icon: Lock,
    bgColor: "bg-primary/10",
    textColor: "text-primary",
    borderColor: "border-primary/20",
  },
  payment_sent: {
    buyerLabel: "Payment sent. Waiting for seller confirmation",
    sellerLabel: "Buyer marked payment as sent. Verify & release crypto",
    icon: CheckCircle,
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-500",
    borderColor: "border-purple-500/20",
  },
  disputed: {
    buyerLabel: "Dispute opened. Moderator reviewing",
    sellerLabel: "Dispute opened. Moderator reviewing",
    icon: AlertTriangle,
    bgColor: "bg-destructive/10",
    textColor: "text-destructive",
    borderColor: "border-destructive/20",
  },
  completed: {
    buyerLabel: "Trade completed successfully",
    sellerLabel: "Trade completed successfully",
    icon: CheckCircle,
    bgColor: "bg-green-500/10",
    textColor: "text-green-500",
    borderColor: "border-green-500/20",
  },
  cancelled: {
    buyerLabel: "Trade was cancelled",
    sellerLabel: "Trade was cancelled",
    icon: AlertTriangle,
    bgColor: "bg-muted",
    textColor: "text-muted-foreground",
    borderColor: "border-border",
  },
};

export const TradeStatusBannerInline = ({
  status,
  isBuyer,
  isSeller,
  escrowLocked,
}: TradeStatusBannerInlineProps) => {
  const config = statusConfigs[status] || statusConfigs.pending;
  const Icon = config.icon;
  
  const label = isBuyer ? config.buyerLabel : config.sellerLabel;

  return (
    <div className={cn(
      "flex items-center gap-2 px-4 py-2.5 border-b",
      config.bgColor,
      config.borderColor
    )}>
      <Icon className={cn("w-4 h-4 shrink-0", config.textColor)} />
      <span className={cn("text-sm font-medium", config.textColor)}>
        {label}
      </span>
      {status === "confirmed" && escrowLocked && (
        <Shield className="w-3.5 h-3.5 text-green-500 ml-auto" />
      )}
    </div>
  );
};
