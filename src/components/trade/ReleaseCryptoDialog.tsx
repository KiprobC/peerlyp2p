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
 import { Input } from "@/components/ui/input";
 import { AlertTriangle, Unlock, Loader2, ShieldAlert } from "lucide-react";
 import { cn } from "@/lib/utils";
   import { usePasskeys } from "@/hooks/usePasskeys";
   import { PasskeyVerifyDialog } from "@/components/security/PasskeyVerifyDialog";
   import { OTPVerificationDialog } from "@/components/security/OTPVerificationDialog";
   import { useConnectivity } from "@/hooks/useConnectivity";
 
interface ReleaseCryptoDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  buyerUsername: string | null;
  cryptoAmount: number;
  cryptoType: string;
  isSeller?: boolean;
}
 
 const DELAY_SECONDS = 3;
 
export const ReleaseCryptoDialog = ({
  open,
  onClose,
  onConfirm,
  buyerUsername,
  cryptoAmount,
  cryptoType,
  isSeller = true,
}: ReleaseCryptoDialogProps) => {
   const isMobile = useIsMobile();
   const [confirmText, setConfirmText] = useState("");
   const [processing, setProcessing] = useState(false);
   const [countdown, setCountdown] = useState(DELAY_SECONDS);
   const [canInteract, setCanInteract] = useState(false);
   const [showPasskey, setShowPasskey] = useState(false);
   const [showOtpFallback, setShowOtpFallback] = useState(false);
   const { passkeys } = usePasskeys();
   const { status: connectivityStatus } = useConnectivity();
   const connectivityBlocked = connectivityStatus !== "online";
 
   // Reset state when dialog opens
   useEffect(() => {
     if (open) {
       setConfirmText("");
       setProcessing(false);
       setCountdown(DELAY_SECONDS);
       setCanInteract(false);
 
       // Start countdown
       const interval = setInterval(() => {
         setCountdown((prev) => {
           if (prev <= 1) {
             clearInterval(interval);
             setCanInteract(true);
             return 0;
           }
           return prev - 1;
         });
       }, 1000);
 
       return () => clearInterval(interval);
     }
   }, [open]);
 
   const isConfirmValid = confirmText.toUpperCase() === "RELEASE";
   const canConfirm = canInteract && isConfirmValid && !processing;
 
   const doRelease = async () => {
     setProcessing(true);
     try {
       await onConfirm();
     } finally {
       setProcessing(false);
       onClose();
     }
   };

   const handleConfirm = async () => {
     if (!canConfirm) return;
     if (passkeys.length > 0) {
       setShowPasskey(true);
       return;
     }
     await doRelease();
   };
 
   const handleClose = () => {
     if (processing) return;
     setConfirmText("");
     onClose();
   };
 
   const content = (
     <>
       <div className="space-y-4">
         {/* Warning Banner */}
         <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
           <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
           <div className="space-y-1">
             <p className="text-sm font-medium text-destructive">
               Irreversible Action
             </p>
             <p className="text-xs text-muted-foreground">
               Once released, the crypto cannot be recovered. Only proceed if you have
               verified payment in full.
             </p>
           </div>
         </div>
 
          {/* Trade Details */}
          <div className="p-4 bg-secondary/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Buyer</span>
              <span className="font-medium">@{buyerUsername || "Unknown"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Escrowed Amount</span>
              <span className="font-bold text-primary">
                {cryptoAmount} {cryptoType}
              </span>
            </div>
            {isSeller && (
              <>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Platform Fee (0.99%)</span>
                  <span className="font-medium text-amber-500">
                    -{(cryptoAmount * 0.0099).toFixed(8)} {cryptoType}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Buyer Receives</span>
                  <span className="font-bold text-green-600">
                    {(cryptoAmount - cryptoAmount * 0.0099).toFixed(8)} {cryptoType}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Platform escrow fee: 0.99% (deducted on release)
                </p>
              </>
            )}
          </div>
 
         {/* Confirmation Input */}
         <div className="space-y-2">
           <label className="text-sm font-medium">
             Type <span className="font-mono bg-secondary px-1.5 py-0.5 rounded">RELEASE</span> to confirm
           </label>
           <Input
             value={confirmText}
             onChange={(e) => setConfirmText(e.target.value)}
             placeholder="Type RELEASE"
             disabled={!canInteract || processing}
             className={cn(
               "font-mono text-center uppercase tracking-widest",
               isConfirmValid && "border-green-500 focus-visible:ring-green-500"
             )}
             autoComplete="off"
           />
         </div>
 
         {/* Countdown Notice */}
         {!canInteract && (
           <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
             <Loader2 className="w-4 h-4 animate-spin" />
             <span>Please wait {countdown} seconds...</span>
           </div>
         )}
       </div>
     </>
   );
 
   const footer = (
     <>
       <Button variant="outline" onClick={handleClose} disabled={processing}>
         Cancel
       </Button>
       <Button
         variant="default"
         onClick={handleConfirm}
         disabled={!canConfirm}
         className={cn(
           "gap-2",
           canConfirm
             ? "bg-green-600 hover:bg-green-700"
             : "opacity-50 cursor-not-allowed"
         )}
       >
         {processing ? (
           <Loader2 className="w-4 h-4 animate-spin" />
         ) : (
           <Unlock className="w-4 h-4" />
         )}
         {processing ? "Releasing..." : "Release Crypto"}
       </Button>
     </>
   );
 
   const passkeyOverlay = (
     <>
       <PasskeyVerifyDialog
         open={showPasskey}
         onOpenChange={setShowPasskey}
         onVerified={doRelease}
         onFallback={() => setShowOtpFallback(true)}
         title="Authorize crypto release"
         description="Use fingerprint or face to authorize this irreversible action"
       />
       <OTPVerificationDialog
         open={showOtpFallback}
         onOpenChange={setShowOtpFallback}
         onVerified={doRelease}
         actionType="sensitive_action"
         title="Verify with email code"
         description="Enter the verification code sent to your email to authorize this release"
         actionLabel="Confirm Release"
       />
     </>
   );

   if (isMobile) {
     return (
       <>
         <Drawer open={open} onOpenChange={handleClose}>
           <DrawerContent className="pb-safe">
             <DrawerHeader className="text-left">
               <DrawerTitle className="flex items-center gap-2">
                 <AlertTriangle className="w-5 h-5 text-amber-500" />
                 Release Crypto to Buyer
               </DrawerTitle>
               <DrawerDescription>
                 You are about to release crypto to the buyer. This action cannot be undone.
               </DrawerDescription>
             </DrawerHeader>
             <div className="px-4">{content}</div>
             <DrawerFooter className="flex-row gap-2">{footer}</DrawerFooter>
           </DrawerContent>
         </Drawer>
         {passkeyOverlay}
       </>
     );
   }

   return (
     <>
       <Dialog open={open} onOpenChange={handleClose}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <AlertTriangle className="w-5 h-5 text-amber-500" />
               Release Crypto to Buyer
             </DialogTitle>
             <DialogDescription>
               You are about to release crypto to the buyer. This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
           {content}
           <DialogFooter className="gap-2 sm:gap-0">{footer}</DialogFooter>
         </DialogContent>
       </Dialog>
       {passkeyOverlay}
     </>
   );
 };