import { Clock, CheckCircle, AlertTriangle, Shield, Lock } from "lucide-react";
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
  color: string;
}> = {
  pending: {
    buyerLabel: "Waiting for seller to lock escrow",
    sellerLabel: "Lock escrow to begin trade",
    icon: Clock,
    color: "text-amber-500",
  },
  confirmed: {
    buyerLabel: "Escrow locked — Send payment now",
    sellerLabel: "Waiting for buyer payment",
    icon: Lock,
    color: "text-primary",
  },
  payment_sent: {
    buyerLabel: "Payment sent — Waiting for confirmation",
    sellerLabel: "Buyer paid — Verify & release crypto",
    icon: CheckCircle,
    color: "text-purple-500",
  },
  disputed: {
    buyerLabel: "Dispute opened — Moderator reviewing",
    sellerLabel: "Dispute opened — Moderator reviewing",
    icon: AlertTriangle,
    color: "text-destructive",
  },
  completed: {
    buyerLabel: "Trade completed",
    sellerLabel: "Trade completed",
    icon: CheckCircle,
    color: "text-green-500",
  },
  cancelled: {
    buyerLabel: "Trade cancelled",
    sellerLabel: "Trade cancelled",
    icon: AlertTriangle,
    color: "text-muted-foreground",
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
    <div className="flex items-center gap-2 px-4 py-2 bg-secondary/40 border-b border-border/30">
      <Icon className={cn("w-4 h-4 shrink-0", config.color)} />
      <span className={cn("text-xs font-medium", config.color)}>
        {label}
      </span>
      {status === "confirmed" && escrowLocked && (
        <Shield className="w-3.5 h-3.5 text-green-500 ml-auto" />
      )}
    </div>
  );
};
