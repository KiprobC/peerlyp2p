import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Shield,
  Star,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  MessageSquare,
  MoreVertical,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrades, useTradeMessages, Trade } from "@/hooks/useTrades";
import { useEscrow } from "@/hooks/useEscrow";
import { useTradeRatings } from "@/hooks/useTradeRatings";
import { RatingDialog } from "@/components/trade/RatingDialog";
import { TraderProfilePopover } from "@/components/trade/TraderProfilePopover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

interface TraderProfile {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rating: number | null;
  total_trades: number | null;
  is_verified: boolean | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "bg-yellow-500/20 text-yellow-500", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-500/20 text-blue-500", icon: Lock },
  payment_sent: { label: "Payment Sent", color: "bg-purple-500/20 text-purple-500", icon: CheckCircle },
  completed: { label: "Completed", color: "bg-green-500/20 text-green-500", icon: CheckCircle },
  disputed: { label: "Disputed", color: "bg-red-500/20 text-red-500", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-gray-500/20 text-gray-500", icon: XCircle },
};

const TradePage = () => {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if (!newMessage.trim()) return;
    setSending(true);

    const { error } = await sendMessage(newMessage.trim());
    if (error) {
      toast.error("Failed to send message");
    } else {
      setNewMessage("");
    }
    setSending(false);
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
      toast.success("Trade confirmed! Crypto is now in escrow.");
      refetchTrades();
    }
    setActionLoading(false);
  };

  const handlePaymentSent = async () => {
    if (!trade) return;
    setActionLoading(true);

    const { error } = await updateTrade(trade.id, {
      status: "payment_sent",
      payment_confirmed_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to update trade");
    } else {
      toast.success("Payment marked as sent!");
      refetchTrades();
    }
    setActionLoading(false);
  };

  const handleReleaseEscrow = async () => {
    if (!trade) return;
    setActionLoading(true);

    // Actually transfer the crypto from seller to buyer
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

    // Update trade status
    const { error } = await updateTrade(trade.id, {
      status: "completed",
      escrow_released: true,
      completed_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Failed to update trade status");
    } else {
      toast.success("Escrow released! Trade completed successfully.");
      refetchTrades();
    }
    setActionLoading(false);
  };

  const handleCancelTrade = async () => {
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

  const handleDispute = async () => {
    if (!trade || !disputeReason.trim()) return;
    setActionLoading(true);

    const { error } = await updateTrade(trade.id, {
      status: "disputed",
      dispute_reason: disputeReason.trim(),
      disputed_at: new Date().toISOString(),
      disputed_by: user?.id,
    });

    if (error) {
      toast.error("Failed to raise dispute");
    } else {
      toast.success("Dispute raised. An admin will review this trade.");
      setDisputeDialogOpen(false);
      setDisputeReason("");
      refetchTrades();
    }
    setActionLoading(false);
  };

  if (!trade) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
          <div className="container mx-auto px-3 sm:px-4">
            <div className="flex items-center h-14 sm:h-16">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Skeleton className="h-5 sm:h-6 w-28 sm:w-32 ml-2" />
            </div>
          </div>
        </nav>
        <main className="pt-20 sm:pt-24 pb-16">
          <div className="container mx-auto px-3 sm:px-4 max-w-4xl space-y-4 sm:space-y-6">
            <Skeleton className="h-40 sm:h-48" />
            <Skeleton className="h-56 sm:h-64" />
          </div>
        </main>
      </div>
    );
  }

  const status = statusConfig[trade.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center min-w-0">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-sm sm:text-lg font-semibold ml-1 sm:ml-2 truncate">
                Trade #{trade.id.slice(0, 8)}
              </h1>
            </div>
            <Badge className={`${status.color} text-xs sm:text-sm shrink-0`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              <span className="hidden xs:inline">{status.label}</span>
            </Badge>
          </div>
        </div>
      </nav>

      <main className="pt-16 sm:pt-18 pb-0">
        <div className="container mx-auto px-0 sm:px-4 max-w-4xl">
          {/* Chat Section - Premium Paxful-style */}
          <div className="bg-card border-x-0 sm:border-x border-t border-b-0 sm:border-b border-border sm:rounded-xl shadow-lg h-[calc(100vh-64px)] sm:h-[calc(100vh-80px)] flex flex-col overflow-hidden pb-20 md:pb-0">
            {/* Messages Area with Trade Info */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-3 bg-gradient-to-b from-secondary/20 to-transparent">
              {/* Counterparty Profile - Scrollable */}
              <div className="p-3 rounded-xl bg-card/80 border border-border/50">
                <TraderProfilePopover userId={isBuyer ? trade.seller_id : trade.buyer_id}>
                  <div className="flex items-center gap-3 cursor-pointer">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                      {counterparty?.avatar_url ? (
                        <img src={counterparty.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        counterparty?.username?.charAt(0) || "?"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{isBuyer ? "Seller" : "Buyer"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm sm:text-base truncate">
                          @{counterparty?.username || "Anonymous"}
                        </span>
                        {counterparty?.is_verified && (
                          <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Star className="w-3 h-3 text-accent fill-accent" />
                        <span>{counterparty?.rating?.toFixed(1) || "0.0"}</span>
                        <span>•</span>
                        <span>{counterparty?.total_trades || 0} trades</span>
                      </div>
                    </div>
                  </div>
                </TraderProfilePopover>
              </div>
              {/* Compact Trade Info Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-border/50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    trade.status === 'completed' ? 'bg-green-500' : 
                    trade.status === 'cancelled' ? 'bg-gray-500' :
                    trade.status === 'disputed' ? 'bg-red-500' : 'bg-primary animate-pulse'
                  }`} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{isBuyer ? 'Buying' : 'Selling'}</span>
                    <span className="font-bold text-sm">{trade.crypto_amount} {trade.crypto_type}</span>
                    <span className="text-xs text-muted-foreground">for</span>
                    <span className="font-medium text-sm">{trade.fiat_currency} {trade.fiat_amount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {trade.escrow_locked && !trade.escrow_released && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium">
                      <Lock className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">Secured</span>
                    </div>
                  )}
                  {trade.escrow_released && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 text-[10px] font-medium">
                      <CheckCircle className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">Released</span>
                    </div>
                  )}
                </div>
              </div>
              {messagesLoading ? (
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className={`h-16 ${i % 2 === 0 ? 'w-3/4' : 'w-2/3 ml-auto'}`} />
                  ))}
                </div>
              ) : messages.length > 0 ? (
                <>
                  {messages.map((message, index) => {
                    const isOwn = message.sender_id === user?.id;
                    const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {/* Avatar placeholder for alignment */}
                        <div className={`w-8 shrink-0 ${!showAvatar && !message.is_system ? 'invisible' : ''}`}>
                          {!message.is_system && showAvatar && (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                              isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                            }`}>
                              {isOwn ? 'You' : counterparty?.username?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        
                        {/* Message bubble */}
                        <div
                          className={`max-w-[75%] ${
                            message.is_system
                              ? "w-full max-w-none mx-8"
                              : ""
                          }`}
                        >
                          {message.is_system ? (
                            <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-secondary/50 border border-border/50">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground text-center">{message.message}</p>
                            </div>
                          ) : (
                            <div
                              className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                                isOwn
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-card border border-border rounded-bl-md"
                              }`}
                            >
                              <p className="text-sm leading-relaxed">{message.message}</p>
                              <p className={`text-[10px] mt-1.5 ${
                                isOwn ? "text-primary-foreground/60" : "text-muted-foreground"
                              }`}>
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm mb-1">No messages yet</p>
                  <p className="text-xs text-muted-foreground/70">Send a message to start the conversation</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {/* Input Area */}
            {!["completed", "cancelled"].includes(trade.status) ? (
              <div className="p-4 sm:p-5 border-t border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sending}
                      className="pr-4 py-5 text-sm bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50 rounded-xl"
                    />
                  </div>
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={sending || !newMessage.trim()}
                    size="icon"
                    className="h-10 w-10 rounded-xl shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                  
                  {/* Actions Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-52 p-2" sideOffset={8}>
                      <div className="flex flex-col gap-1">
                        {/* Seller actions */}
                        {isSeller && trade.status === "pending" && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-sm h-10"
                            onClick={handleConfirmTrade}
                            disabled={actionLoading}
                          >
                            <Lock className="w-4 h-4 mr-3" />
                            Lock Escrow
                          </Button>
                        )}

                        {/* Buyer actions */}
                        {isBuyer && trade.status === "confirmed" && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-sm h-10"
                            onClick={handlePaymentSent}
                            disabled={actionLoading}
                          >
                            <CheckCircle className="w-4 h-4 mr-3" />
                            I've Paid
                          </Button>
                        )}

                        {/* Release Escrow - Seller only */}
                        {isSeller && trade.status === "payment_sent" && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-sm h-10 text-green-600 hover:text-green-600 hover:bg-green-500/10"
                            onClick={handleReleaseEscrow}
                            disabled={actionLoading}
                          >
                            <Unlock className="w-4 h-4 mr-3" />
                            Release Crypto
                          </Button>
                        )}

                        {/* Cancel - Buyer only, before payment */}
                        {isBuyer && ["pending", "confirmed"].includes(trade.status) && (
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-sm h-10"
                            onClick={handleCancelTrade}
                            disabled={actionLoading}
                          >
                            <XCircle className="w-4 h-4 mr-3" />
                            Cancel Trade
                          </Button>
                        )}

                        {/* Dispute */}
                        {!["completed", "cancelled", "disputed"].includes(trade.status) && (
                          <>
                            <div className="h-px bg-border my-1" />
                            <Button
                              variant="ghost"
                              className="w-full justify-start text-sm h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDisputeDialogOpen(true)}
                              disabled={actionLoading}
                            >
                              <AlertTriangle className="w-4 h-4 mr-3" />
                              Report Issue
                            </Button>
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5 border-t border-border bg-card">
                <div className="flex items-center justify-center gap-4">
                  {trade.status === "completed" && !hasRated && (
                    <Button
                      variant="outline"
                      onClick={() => setRatingDialogOpen(true)}
                      className="gap-2"
                    >
                      <Star className="w-4 h-4" />
                      Rate This Trade
                    </Button>
                  )}
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                    trade.status === "completed" 
                      ? "bg-green-500/15 text-green-500" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {trade.status === "completed" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Trade {trade.status === "completed" ? "Completed" : "Cancelled"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dispute Dialog */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent className="mx-4 sm:mx-auto max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Raise Dispute
            </DialogTitle>
            <DialogDescription className="text-sm">
              Please explain the reason for this dispute. An admin will review and take action.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe the issue..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            className="min-h-[100px] text-sm"
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDispute}
              disabled={!disputeReason.trim() || actionLoading}
              className="w-full sm:w-auto"
            >
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        ratedName={counterparty?.full_name || "Trader"}
      />
    </div>
  );
};

export default TradePage;
