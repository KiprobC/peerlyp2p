 import { useState } from "react";
 import { CreditCard, Eye, FileImage, X, ExternalLink } from "lucide-react";
 import { cn } from "@/lib/utils";
 import { Button } from "@/components/ui/button";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import type { TradeEvidence } from "@/hooks/useTradeEvidence";
 
 interface PaymentSentMessageProps {
   message: string;
   isSeller: boolean;
   paymentProofs: TradeEvidence[];
 }
 
 export const PaymentSentMessage = ({
   message,
   isSeller,
   paymentProofs,
 }: PaymentSentMessageProps) => {
   const [proofDialogOpen, setProofDialogOpen] = useState(false);
   const [selectedProof, setSelectedProof] = useState<TradeEvidence | null>(null);
 
   const hasProofs = paymentProofs.length > 0;
 
   const handleViewProof = (proof: TradeEvidence) => {
     setSelectedProof(proof);
   };
 
   const handleOpenInNewTab = (url: string) => {
     window.open(url, "_blank", "noopener,noreferrer");
   };
 
   return (
     <>
       <div
         className={cn(
           "flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border",
           "bg-amber-500/10 border-amber-500/30",
           isSeller && hasProofs && "cursor-pointer hover:bg-amber-500/15 transition-colors"
         )}
         onClick={() => {
           if (isSeller && hasProofs) {
             setProofDialogOpen(true);
           }
         }}
       >
         <CreditCard className="w-4 h-4 shrink-0 text-amber-500" />
         <p className="text-xs text-center leading-relaxed text-amber-400">
           {message}
         </p>
         {isSeller && hasProofs && (
           <Button
             variant="ghost"
             size="sm"
             className="h-6 px-2 ml-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
             onClick={(e) => {
               e.stopPropagation();
               setProofDialogOpen(true);
             }}
           >
             <Eye className="w-3 h-3 mr-1" />
             View Proof
           </Button>
         )}
       </div>
 
       {/* Payment Proof Viewer Dialog */}
       <Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
         <DialogContent className="max-w-lg mx-4 sm:mx-auto max-h-[80vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <FileImage className="w-5 h-5 text-primary" />
               Payment Proof{paymentProofs.length > 1 ? "s" : ""}
             </DialogTitle>
           </DialogHeader>
 
           <div className="space-y-3">
             {paymentProofs.length === 0 ? (
               <div className="text-center py-6 text-muted-foreground">
                 <FileImage className="w-10 h-10 mx-auto mb-2 opacity-50" />
                 <p className="text-sm">No payment proof uploaded yet</p>
               </div>
             ) : (
               paymentProofs.map((proof) => (
                 <div
                   key={proof.id}
                   className={cn(
                     "rounded-lg border border-border overflow-hidden",
                     selectedProof?.id === proof.id && "ring-2 ring-primary"
                   )}
                 >
                   {/* Proof Preview */}
                   {proof.file_type?.startsWith("image/") ? (
                     <div
                       className="relative cursor-pointer group"
                       onClick={() => handleViewProof(proof)}
                     >
                       <img
                         src={proof.file_url}
                         alt={proof.file_name}
                         className="w-full h-48 object-contain bg-secondary"
                       />
                       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <Button variant="secondary" size="sm">
                           <Eye className="w-4 h-4 mr-1" />
                           View Full Size
                         </Button>
                       </div>
                     </div>
                   ) : (
                     <div className="h-32 flex items-center justify-center bg-secondary">
                       <div className="text-center">
                         <FileImage className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                         <p className="text-sm font-medium">{proof.file_name}</p>
                       </div>
                     </div>
                   )}
 
                   {/* Proof Details */}
                   <div className="p-3 space-y-2">
                     <div className="flex items-center justify-between">
                       <span className="text-xs text-muted-foreground">
                         {new Date(proof.created_at).toLocaleString()}
                       </span>
                       <Button
                         variant="outline"
                         size="sm"
                         className="h-7 text-xs"
                         onClick={() => handleOpenInNewTab(proof.file_url)}
                       >
                         <ExternalLink className="w-3 h-3 mr-1" />
                         Open
                       </Button>
                     </div>
                     {proof.description && (
                       <p className="text-xs text-muted-foreground bg-secondary/50 rounded px-2 py-1.5">
                         {proof.description}
                       </p>
                     )}
                   </div>
                 </div>
               ))
             )}
           </div>
         </DialogContent>
       </Dialog>
 
       {/* Full Size Image Viewer */}
       <Dialog open={!!selectedProof} onOpenChange={() => setSelectedProof(null)}>
         <DialogContent className="max-w-4xl mx-4 sm:mx-auto p-0 overflow-hidden">
           <div className="relative">
             <Button
               variant="ghost"
               size="icon"
               className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
               onClick={() => setSelectedProof(null)}
             >
               <X className="w-4 h-4" />
             </Button>
             {selectedProof?.file_type?.startsWith("image/") && (
               <img
                 src={selectedProof.file_url}
                 alt={selectedProof.file_name}
                 className="w-full max-h-[80vh] object-contain bg-black"
               />
             )}
           </div>
         </DialogContent>
       </Dialog>
     </>
   );
 };