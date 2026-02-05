import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Lock, 
  Unlock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  UserCheck,
  Loader2,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface TradeActionsPanelProps {
  status: string;
  isBuyer: boolean;
  isSeller: boolean;
  actionLoading: boolean;
  paymentSentAt: string | null;
  onConfirmTrade: () => Promise<void>;
  onPaymentSent: () => Promise<void>;
   onReleaseEscrow: () => void | Promise<void>;
   onCancelTrade: () => void | Promise<void>;
   onDispute: () => void | Promise<void>;
  onRequestModerator: () => void;
}

const SELLER_CONFIRMATION_WINDOW = 60 * 60 * 1000; // 60 minutes in ms

export const TradeActionsPanel = ({
  status,
  isBuyer,
  isSeller,
  actionLoading,
  paymentSentAt,
  onConfirmTrade,
  onPaymentSent,
  onReleaseEscrow,
  onCancelTrade,
  onDispute,
  onRequestModerator,
}: TradeActionsPanelProps) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [sellerTimeLeft, setSellerTimeLeft] = useState<number | null>(null);
  const [showRequestModerator, setShowRequestModerator] = useState(false);

  // Calculate seller confirmation timer
  useEffect(() => {
    if (status !== "payment_sent" || !paymentSentAt) {
      setSellerTimeLeft(null);
      setShowRequestModerator(false);
      return;
    }

    const calculateTimeLeft = () => {
      const paymentTime = new Date(paymentSentAt).getTime();
      const deadline = paymentTime + SELLER_CONFIRMATION_WINDOW;
      const now = Date.now();
      const remaining = deadline - now;

      if (remaining <= 0) {
        setSellerTimeLeft(0);
        setShowRequestModerator(true);
      } else {
        setSellerTimeLeft(remaining);
        setShowRequestModerator(false);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [status, paymentSentAt]);

   const handleAction = async (action: string, callback: () => void | Promise<void>) => {
    setLoadingAction(action);
    try {
      await callback();
    } finally {
      setLoadingAction(null);
    }
  };

  // Hide panel for completed/cancelled trades
  if (["completed", "cancelled"].includes(status)) {
    return null;
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Determine button states
  const canLockEscrow = isSeller && status === "pending";
  const canMarkPaid = isBuyer && status === "confirmed";
  const canReleaseCrypto = isSeller && status === "payment_sent";
  const canCancel = isBuyer && ["pending", "confirmed"].includes(status);
  const isReleaseDisabled = status !== "payment_sent";

  return (
    <div className="hidden lg:flex flex-col w-48 shrink-0 border-r border-border bg-card/50 p-3 gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        Actions
      </h3>

      {/* Seller Confirmation Timer */}
      {status === "payment_sent" && sellerTimeLeft !== null && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-2",
          sellerTimeLeft === 0 
            ? "bg-red-500/15 text-red-500 border border-red-500/30"
            : sellerTimeLeft < 10 * 60 * 1000
              ? "bg-orange-500/15 text-orange-500 border border-orange-500/30"
              : "bg-primary/10 text-primary border border-primary/30"
        )}>
          <Clock className="w-3.5 h-3.5" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">Seller confirmation</span>
            <span className="font-mono font-bold">
              {sellerTimeLeft === 0 ? "Expired" : formatTime(sellerTimeLeft)}
            </span>
          </div>
        </div>
      )}

      {/* Lock Escrow - Seller only, pending state */}
      {canLockEscrow && (
        <Button
          variant="default"
          size="sm"
          onClick={() => handleAction("lock", onConfirmTrade)}
          disabled={actionLoading || loadingAction !== null}
          className="w-full justify-start gap-2 h-9"
        >
          {loadingAction === "lock" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          Lock Escrow
        </Button>
      )}

      {/* Mark as Paid - Buyer only, confirmed state */}
      {canMarkPaid && (
        <Button
          variant="default"
          size="sm"
          onClick={() => handleAction("paid", onPaymentSent)}
          disabled={actionLoading || loadingAction !== null}
          className="w-full justify-start gap-2 h-9"
        >
          {loadingAction === "paid" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          I've Paid
        </Button>
      )}

      {/* Release Crypto - Seller only, payment_sent state */}
      {isSeller && (
        <Button
          variant="default"
          size="sm"
          onClick={() => handleAction("release", onReleaseEscrow)}
          disabled={actionLoading || loadingAction !== null || isReleaseDisabled}
          className={cn(
            "w-full justify-start gap-2 h-9",
            canReleaseCrypto 
              ? "bg-green-600 hover:bg-green-700" 
              : "opacity-50 cursor-not-allowed"
          )}
        >
          {loadingAction === "release" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Unlock className="w-4 h-4" />
          )}
          Release Crypto
        </Button>
      )}

      {/* Cancel Trade - Buyer only */}
      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction("cancel", onCancelTrade)}
          disabled={actionLoading || loadingAction !== null}
          className="w-full justify-start gap-2 h-9"
        >
          {loadingAction === "cancel" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          Cancel Trade
        </Button>
      )}

      <Separator className="my-2" />

      {/* Request Moderator - Only visible after seller confirmation timer expires */}
      {showRequestModerator && !["disputed", "completed", "cancelled"].includes(status) && (
        <Button
          variant="default"
          size="sm"
          onClick={onRequestModerator}
          disabled={actionLoading || loadingAction !== null}
          className="w-full justify-start gap-2 h-9 bg-amber-600 hover:bg-amber-700"
        >
          <UserCheck className="w-4 h-4" />
          Request Moderator
        </Button>
      )}

      {/* Report Issue - Always visible but de-emphasized */}
      {!["completed", "cancelled", "disputed"].includes(status) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDispute}
          className="w-full justify-start gap-2 h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <AlertTriangle className="w-4 h-4" />
          Report Issue
        </Button>
      )}
    </div>
  );
};
