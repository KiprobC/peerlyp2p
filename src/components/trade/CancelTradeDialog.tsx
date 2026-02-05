 import { useState, useEffect } from "react";
 import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
 import {
   Drawer,
   DrawerContent,
   DrawerDescription,
   DrawerFooter,
   DrawerHeader,
   DrawerTitle,
 } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
 import { AlertTriangle, XCircle, Loader2, ShieldAlert } from "lucide-react";

interface CancelTradeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isBuyer: boolean;
  paymentSent: boolean;
  tradeType: "buy" | "sell";
   cryptoAmount?: number;
   cryptoType?: string;
}

export const CancelTradeDialog = ({
  open,
  onClose,
  onConfirm,
  isBuyer,
  paymentSent,
  tradeType,
   cryptoAmount,
   cryptoType,
}: CancelTradeDialogProps) => {
   const isMobile = useIsMobile();
  const [confirmed, setConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Determine if cancellation is allowed based on rules:
  // - Buy Trade: Only buyer can cancel, only if payment NOT made
  // - Sell Trade: NO ONE can cancel once opened
  const isSellTrade = tradeType === "sell";
  const canCancel = !isSellTrade && isBuyer && !paymentSent;

   // Reset state when dialog opens
   useEffect(() => {
     if (open) {
       setConfirmed(false);
       setProcessing(false);
     }
   }, [open]);
 
  const handleConfirm = async () => {
    if (!confirmed) return;
    setProcessing(true);
     try {
       await onConfirm();
     } finally {
       setProcessing(false);
       onClose();
     }
  };

  const handleClose = () => {
     if (processing) return;
    setConfirmed(false);
    onClose();
  };

   const content = (
     <>
       <div className="space-y-4">
         {/* Warning Banner */}
         <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
           <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
           <div className="space-y-1">
             <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
               Trade Cancellation
             </p>
             <p className="text-xs text-muted-foreground">
               {cryptoAmount && cryptoType
                 ? `Cancelling will return ${cryptoAmount} ${cryptoType} to the seller's wallet. This action cannot be undone.`
                 : "Cancelling will return the escrowed crypto to the seller. This action cannot be undone."}
             </p>
          </div>
         </div>
 
         {!canCancel ? (
           <div className="p-4 bg-secondary/50 rounded-lg">
             <p className="text-sm text-muted-foreground">
               {isSellTrade
                 ? "Sell trades cannot be cancelled once opened. If there's an issue, please raise a dispute for moderator intervention."
                 : paymentSent
                 ? "You cannot cancel this trade because payment has already been marked as sent. If there's an issue, please raise a dispute."
                 : "Only the buyer can cancel this trade. If you need assistance, please raise a dispute."}
             </p>
           </div>
         ) : (
           <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
             <Checkbox
               id="confirm-no-payment"
               checked={confirmed}
               onCheckedChange={(checked) => setConfirmed(checked as boolean)}
               disabled={processing}
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
         )}
       </div>
     </>
   );
 
   const footer = (
     <>
       <Button variant="outline" onClick={handleClose} disabled={processing}>
         {canCancel ? "Go Back" : "Close"}
       </Button>
       {canCancel && (
         <Button
           variant="destructive"
           onClick={handleConfirm}
           disabled={!confirmed || processing}
           className="gap-2"
         >
           {processing ? (
             <Loader2 className="w-4 h-4 animate-spin" />
           ) : (
             <XCircle className="w-4 h-4" />
          )}
           {processing ? "Cancelling..." : "Cancel Trade"}
         </Button>
       )}
     </>
   );
 
   if (isMobile) {
     return (
       <Drawer open={open} onOpenChange={handleClose}>
         <DrawerContent className="pb-safe">
           <DrawerHeader className="text-left">
             <DrawerTitle className="flex items-center gap-2">
               <AlertTriangle className="w-5 h-5 text-amber-500" />
               Cancel Trade?
             </DrawerTitle>
             <DrawerDescription>
               {canCancel
                 ? "Please confirm that you have NOT made any payment for this trade."
                 : "This trade cannot be cancelled."}
             </DrawerDescription>
           </DrawerHeader>
           <div className="px-4">{content}</div>
           <DrawerFooter className="flex-row gap-2">{footer}</DrawerFooter>
         </DrawerContent>
       </Drawer>
     );
   }
 
   return (
     <Dialog open={open} onOpenChange={handleClose}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <AlertTriangle className="w-5 h-5 text-amber-500" />
             Cancel Trade?
           </DialogTitle>
           <DialogDescription>
             {canCancel
               ? "Please confirm that you have NOT made any payment for this trade."
               : "This trade cannot be cancelled."}
           </DialogDescription>
         </DialogHeader>
         {content}
         <DialogFooter className="gap-2 sm:gap-0">{footer}</DialogFooter>
       </DialogContent>
     </Dialog>
  );
};
