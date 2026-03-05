import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TradeEvidence } from "@/hooks/useTradeEvidence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Send,
  AlertTriangle,
  MessageSquare,
  FileImage,
  
  Paperclip,
  Image,
  X,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrades, Trade } from "@/hooks/useTrades";
import { useTradeMessages } from "@/hooks/useTradeMessages";
import { useEscrow } from "@/hooks/useEscrow";
import { useTradeRatings } from "@/hooks/useTradeRatings";
import { useTradeEvidence } from "@/hooks/useTradeEvidence";
import { useDisputeModerator } from "@/hooks/useDisputeModerator";
import { useModeratorRole } from "@/hooks/useModeratorRole";
import { useTradeAuthorization } from "@/hooks/useTradeAuthorization";
import { TradeGuard } from "@/components/auth/TradeGuard";
import { RatingDialog } from "@/components/trade/RatingDialog";
import { TradeHeader } from "@/components/trade/TradeHeader";
import { DisputeHeader } from "@/components/trade/DisputeHeader";
import { TradeActionsPanel } from "@/components/trade/TradeActionsPanel";
import { MobileTradeActions } from "@/components/trade/MobileTradeActions";
import { TradeStatusBannerInline } from "@/components/trade/TradeStatusBannerInline";
import { PaymentWindowTimer } from "@/components/trade/PaymentWindowTimer";
import { ChatMessage } from "@/components/trade/ChatMessage";
import { TimelineEvent } from "@/components/trade/TimelineEvent";
import { TradeStatusBanner } from "@/components/trade/TradeStatusBanner";
import { EvidencePanel } from "@/components/trade/EvidencePanel";
import { EvidenceChatMessage } from "@/components/trade/EvidenceChatMessage";
import { PaymentProofDialog } from "@/components/trade/PaymentProofDialog";
import { ModeratorMessage } from "@/components/trade/ModeratorMessage";
import { ModeratorActionsPanel } from "@/components/trade/ModeratorActionsPanel";
import { ResolutionCard } from "@/components/trade/ResolutionCard";
 import { PaymentSentMessage } from "@/components/trade/PaymentSentMessage";
 import { TradeLockBanner } from "@/components/trade/TradeLockBanner";
 import { useTraderRisk } from "@/hooks/useTraderRisk";
 import { CancelTradeDialog } from "@/components/trade/CancelTradeDialog";
 import { ReleaseCryptoDialog } from "@/components/trade/ReleaseCryptoDialog";
 import { DisputeConfirmDialog } from "@/components/trade/DisputeConfirmDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TraderProfile {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rating: number | null;
  total_trades: number | null;
  is_verified: boolean | null;
}

const TradePageContent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trades, updateTrade, refetch: refetchTrades } = useTrades();
  const { messages, sendMessage, loading: messagesLoading } = useTradeMessages(id || "");
  const { releaseEscrow } = useEscrow();
  const { hasRated, refetch: refetchRatings } = useTradeRatings(id);

  const [trade, setTrade] = useState<Trade | null>(null);
  const [counterparty, setCounterparty] = useState<TraderProfile | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [paymentProofDialogOpen, setPaymentProofDialogOpen] = useState(false);
  
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
   const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
   const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Evidence and moderator hooks
  const { 
    buyerEvidence, 
    sellerEvidence, 
    paymentProofs,
    uploading, 
    uploadEvidence, 
    lockEvidence 
  } = useTradeEvidence(id || "");
  
  const { moderator, assignment } = useDisputeModerator(
    id || "", 
    trade?.assigned_moderator_id
  );
  
  const { isModerator, isAdmin } = useModeratorRole();
  const isModeratorOrAdmin = isModerator || isAdmin;
  const isAssignedModerator = moderator?.id === user?.id;

  const isBuyer = trade?.buyer_id === user?.id;
  const isSeller = trade?.seller_id === user?.id;
  const counterpartyId = isBuyer ? trade?.seller_id : trade?.buyer_id;

  useEffect(() => {
    const foundTrade = trades.find((t) => t.id === id);
    if (foundTrade) {
      setTrade(foundTrade);
      
      // Auto-open rating dialog when trade is completed and user hasn't rated
      if (foundTrade.status === "completed" && !hasRated) {
        setRatingDialogOpen(true);
      }
    }
  }, [trades, id, hasRated]);

  // Fetch counterparty profile
  useEffect(() => {
    const fetchCounterparty = async () => {
      if (!counterpartyId) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url, rating, total_trades, is_verified")
        .eq("user_id", counterpartyId)
        .maybeSingle();

      if (data) {
        setCounterparty(data);
      }
    };

    fetchCounterparty();
  }, [counterpartyId]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !attachmentFile) return;
    setSending(true);

    // If there's an attachment, upload it first
    if (attachmentFile) {
      setUploadingAttachment(true);
      const result = await uploadEvidence(
        attachmentFile, 
        "chat_attachment", 
        isBuyer ? "buyer" : "seller", 
        newMessage.trim() || undefined
      );
      setUploadingAttachment(false);
      
      if (result.success) {
        // Send message with attachment reference
        const attachmentMsg = newMessage.trim() 
          ? `${newMessage.trim()} [Attachment: ${attachmentFile.name}]`
          : `[Attachment: ${attachmentFile.name}]`;
        await sendMessage(attachmentMsg);
        setNewMessage("");
        clearAttachment();
      } else {
        toast.error("Failed to upload attachment");
      }
    } else {
      const { error } = await sendMessage(newMessage.trim());
      if (error) {
        toast.error("Failed to send message");
      } else {
        setNewMessage("");
      }
    }
    setSending(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB");
      return;
    }

    setAttachmentFile(file);
    
    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setAttachmentPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmTrade = async () => {
    if (!trade) return;
    setActionLoading(true);

    const { error } = await updateTrade(trade.id, {
      status: "confirmed",
      escrow_locked: true,
    });

    if (error) {
      toast.error("Failed to confirm trade");
    } else {
      toast.success("Escrow locked successfully");
      refetchTrades();
    }
    setActionLoading(false);
  };

  const handlePaymentSent = async () => {
    // Payment proof is now required - open dialog instead
    setPaymentProofDialogOpen(true);
  };

  const handlePaymentProofSubmit = async (file: File, description?: string): Promise<boolean> => {
    if (!trade) return false;
    
    // Upload payment proof
    const result = await uploadEvidence(file, "payment_proof", "buyer", description);
    if (!result.success) return false;
    
    // Update trade status
    const { error } = await updateTrade(trade.id, {
      status: "payment_sent",
      payment_confirmed_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to update trade");
      return false;
    }
    
    toast.success("Payment proof submitted");
    refetchTrades();
    setPaymentProofDialogOpen(false);
    return true;
  };

   const handleOpenCancelDialog = () => {
     setCancelDialogOpen(true);
   };
 
   const handleConfirmCancelTrade = async () => {
    if (!trade) return;
    setActionLoading(true);

    const { error } = await updateTrade(trade.id, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id,
    });

    if (error) {
      toast.error("Failed to cancel trade");
    } else {
      toast.success("Trade cancelled");
      refetchTrades();
    }
    setActionLoading(false);
  };

   const handleOpenReleaseDialog = () => {
     setReleaseDialogOpen(true);
   };
 
   const handleConfirmReleaseCrypto = async () => {
     if (!trade) return;
     setActionLoading(true);
 
     const escrowResult = await releaseEscrow(
       trade.seller_id,
       trade.buyer_id,
       trade.crypto_type,
       trade.crypto_amount,
       trade.id
     );
 
     if (!escrowResult.success) {
       toast.error(escrowResult.error || "Failed to release escrow");
       setActionLoading(false);
       return;
     }
 
     // Trade is already marked completed by the RPC function
     toast.success(
       `Crypto released! Fee: ${escrowResult.fee_amount?.toFixed(8) || '0'} ${trade.crypto_type}`
     );
     refetchTrades();
     setActionLoading(false);
   };
 
   const handleOpenDisputeDialog = () => {
     setDisputeDialogOpen(true);
   };
 
   const handleConfirmDispute = async (reason: string) => {
     if (!trade) return;
    setActionLoading(true);

    const { error } = await updateTrade(trade.id, {
      status: "disputed",
       dispute_reason: reason,
      disputed_at: new Date().toISOString(),
      disputed_by: user?.id,
    });

    if (error) {
      toast.error("Failed to raise dispute");
    } else {
      toast.success("Dispute raised. A moderator will be assigned automatically.");
      setDisputeDialogOpen(false);
      setDisputeReason("");
      refetchTrades();
    }
    setActionLoading(false);
  };

  const handleRequestModerator = () => {
    // Opens the dispute dialog with pre-filled context
    setDisputeReason("Seller has not released crypto after 60 minutes since payment was marked as sent.");
    setDisputeDialogOpen(true);
  };

  // Loading state
  if (!trade) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-3 max-w-4xl">
            <div className="flex items-center h-12 gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </header>
        <main className="flex-1 pb-20">
          <div className="container mx-auto px-3 max-w-4xl space-y-3 py-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-64" />
          </div>
        </main>
      </div>
    );
  }

  // Chat input visible states: awaiting_payment, escrow_locked, payment_sent, dispute_opened, confirmed, pending
  const chatVisibleStates = ["pending", "confirmed", "awaiting_payment", "escrow_locked", "payment_sent", "disputed"];
  const isChatActive = chatVisibleStates.includes(trade.status);
  const isTradeActive = !["completed", "cancelled"].includes(trade.status);
  const isDisputed = trade.status === "disputed";
  const isDisputeResolved = trade.resolution_type !== null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Compact Sticky Header - show dispute header if disputed */}
      {isDisputed || isDisputeResolved ? (
        <DisputeHeader
          tradeId={trade.id}
          cryptoAmount={trade.crypto_amount}
          cryptoType={trade.crypto_type}
          fiatAmount={trade.fiat_amount}
          fiatCurrency={trade.fiat_currency || "USD"}
          status={trade.status}
          escrowLocked={trade.escrow_locked || false}
          moderator={moderator}
          assignment={assignment}
          onBack={() => navigate("/trades")}
        />
      ) : (
         <TradeHeader
          tradeId={trade.id}
          cryptoAmount={trade.crypto_amount}
          cryptoType={trade.crypto_type}
          fiatAmount={trade.fiat_amount}
          fiatCurrency={trade.fiat_currency}
          status={trade.status}
          expiresAt={trade.expires_at}
          counterpartyUsername={counterparty?.username}
          counterpartyVerified={counterparty?.is_verified || false}
          counterpartyId={counterpartyId}
          escrowLocked={trade.escrow_locked}
          escrowReleased={trade.escrow_released}
          onBack={() => navigate("/trades")}
          onExpired={refetchTrades}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <div className="container mx-auto px-0 sm:px-4 max-w-5xl flex-1 flex flex-col">
          <div className="flex-1 flex bg-card sm:border-x sm:border-t border-border sm:rounded-t-xl overflow-hidden">
            
            {/* Left Actions Panel - Desktop only (visible during disputes for seller release) */}
            {!isDisputeResolved && (
              <TradeActionsPanel
                status={trade.status}
                isBuyer={isBuyer}
                isSeller={isSeller}
                actionLoading={actionLoading}
                paymentSentAt={trade.payment_confirmed_at}
                onConfirmTrade={handleConfirmTrade}
                onPaymentSent={handlePaymentSent}
               onReleaseEscrow={handleOpenReleaseDialog}
               onCancelTrade={handleOpenCancelDialog}
               onDispute={handleOpenDisputeDialog}
                onRequestModerator={handleRequestModerator}
              />
            )}
            
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Status Banner */}
              {!isDisputed && !isDisputeResolved && !["completed", "cancelled"].includes(trade.status) && (
                <TradeStatusBannerInline
                  status={trade.status}
                  isBuyer={isBuyer}
                  isSeller={isSeller}
                  escrowLocked={trade.escrow_locked || false}
                />
              )}

              {/* Trade Lock Indicators */}
              <TradeLockBanner
                escrowLocked={trade.escrow_locked || false}
                status={trade.status}
                cryptoAmount={trade.crypto_amount}
                cryptoType={trade.crypto_type}
                fiatAmount={trade.fiat_amount}
                fiatCurrency={trade.fiat_currency || "USD"}
                paymentMethod={trade.payment_method}
              />

              {/* Risk Warning Banner */}
              <RiskWarningBanner counterpartyId={counterpartyId} />
              
              {/* Payment Window Timer - only for pending/confirmed */}
              {["pending", "confirmed"].includes(trade.status) && trade.expires_at && (
                <div className="px-3 py-2 border-b border-border bg-secondary/30">
                  <PaymentWindowTimer
                    expiresAt={trade.expires_at}
                    tradeStatus={trade.status}
                    onExpired={refetchTrades}
                  />
                </div>
              )}
              
              {/* Resolution Card - show when dispute is resolved */}
              {isDisputeResolved && (trade.resolution_type === "buyer_wins" || trade.resolution_type === "seller_wins" || trade.resolution_type === "split" || trade.resolution_type === "cancelled") && (
                <div className="p-3">
                  <ResolutionCard
                    resolutionType={trade.resolution_type}
                    resolutionSummary={trade.dispute_resolution_summary || "Dispute has been resolved."}
                    resolvedAt={trade.completed_at || trade.cancelled_at || new Date().toISOString()}
                    cryptoAmount={trade.crypto_amount}
                    cryptoType={trade.crypto_type}
                  />
                </div>
              )}

              {/* Tabbed Layout for Disputes */}
              {isDisputed && !isDisputeResolved ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Moderator Actions Panel - only for assigned moderator/admin */}
                  {isAssignedModerator && trade && (
                    <ModeratorActionsPanel
                      tradeId={trade.id}
                      buyerId={trade.buyer_id}
                      sellerId={trade.seller_id}
                      moderatorId={user?.id || ""}
                      onResolved={refetchTrades}
                    />
                  )}

                  {/* Dispute evidence upload bar */}
                  {(isBuyer || isSeller) && (
                    <div className="px-3 py-2 border-b border-border bg-secondary/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileImage className="w-3.5 h-3.5" />
                          <span>Upload dispute evidence</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Image className="w-3 h-3" />
                          Add Evidence
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Chat + Evidence merged scroll area */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 pb-40 lg:pb-32 space-y-2">
                    {renderMessages()}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              ) : (
                /* Normal Chat Layout with Evidence Section */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Evidence Upload Section - show for confirmed/payment_sent states */}
                  {["confirmed", "payment_sent"].includes(trade.status) && (
                    <div className="px-3 py-2 border-b border-border bg-secondary/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileImage className="w-3.5 h-3.5" />
                          <span>Evidence: {isBuyer ? "Upload payment proof" : "Review buyer proof"}</span>
                        </div>
                        {isBuyer && paymentProofs.length === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => setPaymentProofDialogOpen(true)}
                          >
                            <Image className="w-3 h-3" />
                            Add Proof
                          </Button>
                        )}
                        {paymentProofs.length > 0 && (
                          <span className="text-xs text-green-500 flex items-center gap-1">
                            ✓ {paymentProofs.length} uploaded
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Chat Messages - increased bottom padding on mobile to prevent overlap with fixed action bar */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 pb-44 lg:pb-32 space-y-2">
                    {renderMessages()}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}

              {/* Trade Status Banner (for completed/cancelled) */}
              {["completed", "cancelled"].includes(trade.status) && (
                <TradeStatusBanner
                  status={trade.status}
                  hasRated={hasRated}
                  onRate={() => setRatingDialogOpen(true)}
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Input & Actions Area - Fixed at bottom with proper mobile safe area */}
        {isChatActive && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md">
            <div className="container mx-auto px-3 max-w-5xl">
              {/* Mobile Action Buttons - show during disputes for seller release */}
              {(
                <div className="lg:hidden border-b border-border/50 bg-gradient-to-t from-card/50 to-transparent">
                  <MobileTradeActions
                    status={trade.status}
                    isBuyer={isBuyer}
                    isSeller={isSeller}
                    actionLoading={actionLoading}
                    paymentSentAt={trade.payment_confirmed_at}
                    onConfirmTrade={handleConfirmTrade}
                    onPaymentSent={handlePaymentSent}
                   onReleaseEscrow={handleOpenReleaseDialog}
                   onCancelTrade={handleOpenCancelDialog}
                   onDispute={handleOpenDisputeDialog}
                    onRequestModerator={handleRequestModerator}
                  />
                </div>
              )}
              
              {/* Attachment Preview */}
              {attachmentFile && (
                <div className="flex items-center gap-2 px-1 pt-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/80 text-xs max-w-[200px]">
                    {attachmentPreview ? (
                      <img src={attachmentPreview} alt="Preview" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <FileImage className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{attachmentFile.name}</span>
                    <button 
                      onClick={clearAttachment}
                      className="p-0.5 hover:bg-muted rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Message Input with Attachment - proper bottom padding for iOS */}
              <div className="flex items-center gap-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || uploadingAttachment}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  placeholder={isDisputed ? "Message moderator..." : "Type a message..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sending || uploadingAttachment}
                  className="flex-1 h-9 text-sm bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-lg"
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={sending || uploadingAttachment || (!newMessage.trim() && !attachmentFile)}
                  size="icon"
                  className="h-9 w-9 rounded-lg shrink-0"
                >
                  {(sending || uploadingAttachment) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Payment Proof Dialog */}
      <PaymentProofDialog
        open={paymentProofDialogOpen}
        onClose={() => setPaymentProofDialogOpen(false)}
        onSubmit={handlePaymentProofSubmit}
        paymentMethod={trade.payment_method}
        fiatAmount={trade.fiat_amount}
        fiatCurrency={trade.fiat_currency || "USD"}
      />

       {/* Cancel Trade Dialog */}
       <CancelTradeDialog
         open={cancelDialogOpen}
         onClose={() => setCancelDialogOpen(false)}
         onConfirm={handleConfirmCancelTrade}
         isBuyer={isBuyer}
         paymentSent={trade.status === "payment_sent"}
         tradeType={isBuyer ? "buy" : "sell"}
         cryptoAmount={trade.crypto_amount}
         cryptoType={trade.crypto_type}
       />
 
       {/* Release Crypto Dialog */}
       <ReleaseCryptoDialog
         open={releaseDialogOpen}
         onClose={() => setReleaseDialogOpen(false)}
         onConfirm={handleConfirmReleaseCrypto}
         buyerUsername={counterparty?.username || null}
         cryptoAmount={trade.crypto_amount}
         cryptoType={trade.crypto_type}
         isSeller={isSeller}
       />
 
       {/* Dispute Dialog */}
       <DisputeConfirmDialog
         open={disputeDialogOpen}
         onClose={() => {
           setDisputeDialogOpen(false);
           setDisputeReason("");
         }}
         onConfirm={handleConfirmDispute}
         initialReason={disputeReason}
       />

      {/* Rating Dialog */}
      <RatingDialog
        open={ratingDialogOpen}
        onClose={() => {
          setRatingDialogOpen(false);
          refetchRatings();
        }}
        tradeId={trade.id}
        raterId={user?.id || ""}
        ratedId={counterpartyId || ""}
        ratedName={counterparty?.full_name || counterparty?.username || "Trader"}
      />
    </div>
  );

  // Helper function to render messages with inline evidence
  function renderMessages() {
    if (messagesLoading) {
      return (
        <div className="flex flex-col gap-3 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className={`h-12 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'}`} 
            />
          ))}
        </div>
      );
    }
    
    // Merge messages and evidence into a single timeline
    const allEvidence = [...buyerEvidence, ...sellerEvidence];
    
    type TimelineItem = 
      | { type: "message"; data: typeof messages[0]; timestamp: string }
      | { type: "evidence"; data: TradeEvidence; timestamp: string };

    const timeline: TimelineItem[] = [
      ...messages.map(m => ({ type: "message" as const, data: m, timestamp: m.created_at })),
      ...allEvidence
        .filter(e => e.evidence_type !== "chat_attachment") // chat attachments are already in messages
        .map(e => ({ type: "evidence" as const, data: e, timestamp: e.created_at })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (timeline.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No messages yet</p>
          <p className="text-xs text-muted-foreground/70">Start the conversation</p>
        </div>
      );
    }
    
    return timeline.map((item, index) => {
      if (item.type === "evidence") {
        const ev = item.data as TradeEvidence;
        const isOwnEvidence = ev.uploader_id === user?.id;
        const prevItem = index > 0 ? timeline[index - 1] : null;
        const showAvatar = !prevItem || 
          (prevItem.type === "message" ? prevItem.data.sender_id !== ev.uploader_id : 
           prevItem.type === "evidence" ? (prevItem.data as TradeEvidence).uploader_id !== ev.uploader_id : true);

        const uploaderName = isOwnEvidence ? "You" : (counterparty?.username || "User");
        
        return (
          <EvidenceChatMessage
            key={`evidence-${ev.id}`}
            evidence={ev}
            isOwn={isOwnEvidence}
            senderName={uploaderName}
            avatarUrl={isOwnEvidence ? null : counterparty?.avatar_url}
            showAvatar={showAvatar}
          />
        );
      }

      const message = item.data as typeof messages[0];
      const isOwn = message.sender_id === user?.id;
      const prevItem = index > 0 ? timeline[index - 1] : null;
      const showAvatar = !prevItem ||
        (prevItem.type === "message" ? prevItem.data.sender_id !== message.sender_id :
         prevItem.type === "evidence" ? (prevItem.data as TradeEvidence).uploader_id !== message.sender_id : true);
      
      // System message: show as timeline event
      if (message.is_system) {
        const lowerMsg = message.message.toLowerCase();
        if (isSeller && lowerMsg.includes('buying')) return null;
        if (isBuyer && lowerMsg.includes('selling')) return null;
        
        // Payment sent message - show with proof viewer for seller
        if (lowerMsg.includes('payment') && (lowerMsg.includes('sent') || lowerMsg.includes('💸'))) {
          return (
            <PaymentSentMessage
              key={message.id}
              message={message.message}
              isSeller={isSeller}
              paymentProofs={paymentProofs}
            />
          );
        }
        
        // Check if it's a moderator message
        if (lowerMsg.includes('moderator') || lowerMsg.includes('dispute')) {
          return (
            <ModeratorMessage
              key={message.id}
              message={message.message}
              timestamp={message.created_at}
            />
          );
        }
        
        return (
          <TimelineEvent 
            key={message.id} 
            message={message.message} 
          />
        );
      }
      
      // User message
      return (
        <ChatMessage
          key={message.id}
          message={message.message}
          isOwn={isOwn}
          senderName={isOwn ? "You" : (counterparty?.username || "User")}
          avatarUrl={isOwn ? null : counterparty?.avatar_url}
          timestamp={message.created_at}
          showAvatar={showAvatar}
        />
      );
    });
  }
};

// Risk warning banner for counterparty
const RiskWarningBanner = ({ counterpartyId }: { counterpartyId: string | undefined }) => {
  const { riskData } = useTraderRisk(counterpartyId);
  if (!riskData || !["watchlist", "high_risk"].includes(riskData.risk_level)) return null;
  return (
    <div className="mx-3 my-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <span className="text-destructive font-medium">
        ⚠ This trader is flagged for suspicious activity. Trade with caution.
      </span>
    </div>
  );
};

// Wrapper component with trade authorization
const TradePage = () => {
  const { id } = useParams<{ id: string }>();
  
  return (
    <TradeGuard tradeId={id}>
      <TradePageContent />
    </TradeGuard>
  );
};

export default TradePage;
