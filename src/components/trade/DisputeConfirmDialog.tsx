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
 import { Textarea } from "@/components/ui/textarea";
 import { Checkbox } from "@/components/ui/checkbox";
 import { AlertTriangle, Shield, Loader2, FileWarning } from "lucide-react";
 
 interface DisputeConfirmDialogProps {
   open: boolean;
   onClose: () => void;
   onConfirm: (reason: string) => Promise<void>;
   initialReason?: string;
 }
 
 export const DisputeConfirmDialog = ({
   open,
   onClose,
   onConfirm,
   initialReason = "",
 }: DisputeConfirmDialogProps) => {
   const isMobile = useIsMobile();
   const [reason, setReason] = useState(initialReason);
   const [understood, setUnderstood] = useState(false);
   const [processing, setProcessing] = useState(false);
 
   // Reset state when dialog opens
   useEffect(() => {
     if (open) {
       setReason(initialReason);
       setUnderstood(false);
       setProcessing(false);
     }
   }, [open, initialReason]);
 
   const canConfirm = reason.trim().length >= 10 && understood && !processing;
 
   const handleConfirm = async () => {
     if (!canConfirm) return;
     setProcessing(true);
     try {
       await onConfirm(reason.trim());
     } finally {
       setProcessing(false);
     }
   };
 
   const handleClose = () => {
     if (processing) return;
     onClose();
   };
 
   const content = (
     <>
       <div className="space-y-4">
         {/* Info Banner */}
         <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
           <Shield className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
           <div className="space-y-1">
             <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
               Moderator Will Be Assigned
             </p>
             <p className="text-xs text-muted-foreground">
               A moderator will review this dispute and may request additional evidence
               from both parties. The trade will be frozen until resolved.
             </p>
           </div>
         </div>
 
         {/* Evidence Notice */}
         <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
           <FileWarning className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
           <p className="text-xs text-muted-foreground">
             You may be required to provide payment proof, screenshots, or other
             evidence to support your case.
           </p>
         </div>
 
         {/* Reason Input */}
         <div className="space-y-2">
           <label className="text-sm font-medium">
             Describe the issue <span className="text-destructive">*</span>
           </label>
           <Textarea
             value={reason}
             onChange={(e) => setReason(e.target.value)}
             placeholder="Explain why you're opening this dispute (minimum 10 characters)..."
             disabled={processing}
             className="min-h-[100px] resize-none"
             maxLength={500}
           />
           <p className="text-xs text-muted-foreground text-right">
             {reason.length}/500
           </p>
         </div>
 
         {/* Confirmation Checkbox */}
         <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg border">
           <Checkbox
             id="dispute-understood"
             checked={understood}
             onCheckedChange={(checked) => setUnderstood(checked as boolean)}
             disabled={processing}
           />
           <label
             htmlFor="dispute-understood"
             className="text-sm cursor-pointer leading-relaxed"
           >
             I understand that opening a dispute will freeze this trade and involve
             moderator review. I am prepared to provide evidence if requested.
           </label>
         </div>
       </div>
     </>
   );
 
   const footer = (
     <>
       <Button variant="outline" onClick={handleClose} disabled={processing}>
         Cancel
       </Button>
       <Button
         variant="destructive"
         onClick={handleConfirm}
         disabled={!canConfirm}
         className="gap-2"
       >
         {processing ? (
           <Loader2 className="w-4 h-4 animate-spin" />
         ) : (
           <AlertTriangle className="w-4 h-4" />
         )}
         {processing ? "Opening Dispute..." : "Open Dispute"}
       </Button>
     </>
   );
 
   if (isMobile) {
     return (
       <Drawer open={open} onOpenChange={handleClose}>
         <DrawerContent className="pb-safe max-h-[90vh]">
           <DrawerHeader className="text-left">
             <DrawerTitle className="flex items-center gap-2">
               <AlertTriangle className="w-5 h-5 text-amber-500" />
               Report Issue / Open Dispute
             </DrawerTitle>
             <DrawerDescription>
               Report a problem with this trade to involve a moderator.
             </DrawerDescription>
           </DrawerHeader>
           <div className="px-4 overflow-y-auto">{content}</div>
           <DrawerFooter className="flex-row gap-2">{footer}</DrawerFooter>
         </DrawerContent>
       </Drawer>
     );
   }
 
   return (
     <Dialog open={open} onOpenChange={handleClose}>
       <DialogContent className="sm:max-w-lg">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <AlertTriangle className="w-5 h-5 text-amber-500" />
             Report Issue / Open Dispute
           </DialogTitle>
           <DialogDescription>
             Report a problem with this trade to involve a moderator.
           </DialogDescription>
         </DialogHeader>
         {content}
         <DialogFooter className="gap-2 sm:gap-0">{footer}</DialogFooter>
       </DialogContent>
     </Dialog>
   );
 };