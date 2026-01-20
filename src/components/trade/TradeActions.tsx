import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Lock, 
  Unlock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TradeActionsProps {
  status: string;
  isBuyer: boolean;
  isSeller: boolean;
  actionLoading: boolean;
  onConfirmTrade: () => Promise<void>;
  onPaymentSent: () => Promise<void>;
  onReleaseEscrow: () => Promise<void>;
  onCancelTrade: () => Promise<void>;
  onDispute: () => void;
}

export const TradeActions = ({
  status,
  isBuyer,
  isSeller,
  actionLoading,
  onConfirmTrade,
  onPaymentSent,
  onReleaseEscrow,
  onCancelTrade,
  onDispute,
}: TradeActionsProps) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = async (action: string, callback: () => Promise<void>) => {
    setLoadingAction(action);
    try {
      await callback();
    } finally {
      setLoadingAction(null);
    }
  };

  // Hide actions for completed/cancelled trades
  if (["completed", "cancelled", "disputed"].includes(status)) {
    return null;
  }

  const actions = [];

  // Seller: Lock Escrow (pending)
  if (isSeller && status === "pending") {
    actions.push({
      key: "lock",
      label: "Lock Escrow",
      icon: Lock,
      variant: "default" as const,
      onClick: () => handleAction("lock", onConfirmTrade),
      className: "bg-primary hover:bg-primary/90",
    });
  }

  // Buyer: Mark as Paid (confirmed)
  if (isBuyer && status === "confirmed") {
    actions.push({
      key: "paid",
      label: "I've Paid",
      icon: CheckCircle,
      variant: "default" as const,
      onClick: () => handleAction("paid", onPaymentSent),
      className: "bg-primary hover:bg-primary/90",
    });
  }

  // Seller: Release Crypto (payment_sent)
  if (isSeller && status === "payment_sent") {
    actions.push({
      key: "release",
      label: "Release Crypto",
      icon: Unlock,
      variant: "default" as const,
      onClick: () => handleAction("release", onReleaseEscrow),
      className: "bg-green-600 hover:bg-green-700",
    });
  }

  // Buyer: Cancel Trade (pending/confirmed)
  if (isBuyer && ["pending", "confirmed"].includes(status)) {
    actions.push({
      key: "cancel",
      label: "Cancel",
      icon: XCircle,
      variant: "outline" as const,
      onClick: () => handleAction("cancel", onCancelTrade),
      className: "border-border hover:bg-muted",
    });
  }

  // Both: Report Issue
  actions.push({
    key: "dispute",
    label: "Report",
    icon: AlertTriangle,
    variant: "ghost" as const,
    onClick: onDispute,
    className: "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
  });

  if (actions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {actions.map((action) => {
        const Icon = action.icon;
        const isLoading = loadingAction === action.key || actionLoading;
        
        return (
          <Button
            key={action.key}
            variant={action.variant}
            size="sm"
            onClick={action.onClick}
            disabled={isLoading}
            className={cn("h-8 text-xs gap-1.5", action.className)}
          >
            {loadingAction === action.key ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Icon className="w-3.5 h-3.5" />
            )}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
};
