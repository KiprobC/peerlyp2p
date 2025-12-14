import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";

interface CancelTradeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isBuyer: boolean;
  paymentSent: boolean;
  tradeType: "buy" | "sell";
}

export const CancelTradeDialog = ({
  open,
  onClose,
  onConfirm,
  isBuyer,
  paymentSent,
  tradeType,
}: CancelTradeDialogProps) => {
  const [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Determine if cancellation is allowed based on rules:
  // - Buy Trade: Only buyer can cancel, only if payment NOT made
  // - Sell Trade: NO ONE can cancel once opened
  const isSellTrade = tradeType === "sell";
  const canCancel = !isSellTrade && isBuyer && !paymentSent;

  const handleConfirm = async () => {
    if (!confirmed) return;
    setProcessing(true);
    await onConfirm();
    setProcessing(false);
    onClose();
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Cancel Trade
          </DialogTitle>
          <DialogDescription>
            {!canCancel ? (
              isSellTrade ? (
                "Sell trades cannot be cancelled once opened. If there's an issue, please raise a dispute for admin intervention."
              ) : paymentSent ? (
                "You cannot cancel this trade because payment has already been marked as sent. If there's an issue, please raise a dispute."
              ) : (
                "Only the buyer can cancel this trade. If you need assistance, please raise a dispute."
              )
            ) : (
              "Please confirm that you have NOT made any payment for this trade."
            )}
          </DialogDescription>
        </DialogHeader>

        {canCancel && (
          <div className="py-4">
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <Checkbox
                id="confirm-no-payment"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked as boolean)}
              />
              <label
                htmlFor="confirm-no-payment"
                className="text-sm cursor-pointer leading-relaxed"
              >
                I confirm that I have <strong>NOT</strong> made any payment for this trade.
                I understand that falsely claiming no payment was made may result in
                account suspension.
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {canCancel ? "Go Back" : "Close"}
          </Button>
          {canCancel && (
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!confirmed || processing}
            >
              {processing ? "Cancelling..." : "Cancel Trade"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
