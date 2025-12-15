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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrades, useTradeMessages, Trade } from "@/hooks/useTrades";
import { useEscrow } from "@/hooks/useEscrow";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

interface TraderProfile {
  full_name: string | null;
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
  
  const [trade, setTrade] = useState<Trade | null>(null);
  const [counterparty, setCounterparty] = useState<TraderProfile | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isBuyer = trade?.buyer_id === user?.id;
  const isSeller = trade?.seller_id === user?.id;
  const counterpartyId = isBuyer ? trade?.seller_id : trade?.buyer_id;

  useEffect(() => {
    const foundTrade = trades.find((t) => t.id === id);
    if (foundTrade) {
      setTrade(foundTrade);
    }
  }, [trades, id]);

  // Fetch counterparty profile
  useEffect(() => {
    const fetchCounterparty = async () => {
      if (!counterpartyId) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, rating, total_trades, is_verified")
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
          <div className="container mx-auto px-4">
            <div className="flex items-center h-16">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Skeleton className="h-6 w-32 ml-2" />
            </div>
          </div>
        </nav>
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-4xl space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
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
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold ml-2">
                Trade #{trade.id.slice(0, 8)}
              </h1>
            </div>
            <Badge className={status.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trade Details */}
            <div className="lg:col-span-1 space-y-6">
              {/* Trade Summary */}
              <div className="glass-card">
                <h3 className="font-semibold mb-4">Trade Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant={isBuyer ? "default" : "secondary"}>
                      {isBuyer ? "Buying" : "Selling"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold">
                      {trade.crypto_amount} {trade.crypto_type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">
                      {trade.fiat_currency} {trade.fiat_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment</span>
                    <span>{trade.payment_method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{format(new Date(trade.created_at), "MMM d, HH:mm")}</span>
                  </div>
                </div>

                {/* Escrow Status */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    {trade.escrow_locked ? (
                      <>
                        <Lock className="w-4 h-4 text-primary" />
                        <span className="text-primary">Crypto locked in escrow</span>
                      </>
                    ) : trade.escrow_released ? (
                      <>
                        <Unlock className="w-4 h-4 text-green-500" />
                        <span className="text-green-500">Escrow released</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Awaiting escrow</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Counterparty */}
              <div className="glass-card">
                <h3 className="font-semibold mb-4">
                  {isBuyer ? "Seller" : "Buyer"}
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {counterparty?.full_name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {counterparty?.full_name || "Anonymous"}
                      </span>
                      {counterparty?.is_verified && (
                        <Shield className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="w-3 h-3 text-accent fill-accent" />
                      <span>{counterparty?.rating?.toFixed(1) || "0.0"}</span>
                      <span>•</span>
                      <span>{counterparty?.total_trades || 0} trades</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="glass-card space-y-3">
                <h3 className="font-semibold mb-4">Actions</h3>

                {/* Seller actions */}
                {isSeller && trade.status === "pending" && (
                  <Button
                    className="w-full"
                    onClick={handleConfirmTrade}
                    disabled={actionLoading}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Confirm & Lock Escrow
                  </Button>
                )}

                {isSeller && trade.status === "payment_sent" && (
                  <Button
                    className="w-full"
                    onClick={handleReleaseEscrow}
                    disabled={actionLoading}
                  >
                    <Unlock className="w-4 h-4 mr-2" />
                    Release Escrow
                  </Button>
                )}

                {/* Buyer actions */}
                {isBuyer && trade.status === "confirmed" && (
                  <Button
                    className="w-full"
                    onClick={handlePaymentSent}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    I've Sent Payment
                  </Button>
                )}

                {/* Cancel (only before payment) */}
                {["pending", "confirmed"].includes(trade.status) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCancelTrade}
                    disabled={actionLoading}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancel Trade
                  </Button>
                )}

                {/* Dispute (after payment sent) */}
                {["payment_sent", "confirmed"].includes(trade.status) && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setDisputeDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Raise Dispute
                  </Button>
                )}

                {trade.status === "completed" && (
                  <div className="text-center py-4">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-green-500 font-semibold">Trade Completed!</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(trade.completed_at!), "MMM d, yyyy 'at' HH:mm")}
                    </p>
                  </div>
                )}

                {trade.status === "disputed" && (
                  <div className="text-center py-4">
                    <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
                    <p className="text-destructive font-semibold">Under Review</p>
                    <p className="text-sm text-muted-foreground">
                      An admin is reviewing this dispute
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Section */}
            <div className="lg:col-span-2">
              <div className="glass-card h-[600px] flex flex-col">
                <div className="flex items-center gap-2 pb-4 border-b border-border">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Trade Chat</h3>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                  {messagesLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-3/4" />
                    ))
                  ) : messages.length > 0 ? (
                    messages.map((message) => {
                      const isOwn = message.sender_id === user?.id;
                      
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl px-4 py-2 ${
                              message.is_system
                                ? "bg-secondary text-muted-foreground text-center w-full"
                                : isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary"
                            }`}
                          >
                            <p className="text-sm">{message.message}</p>
                            <p className={`text-xs mt-1 ${
                              isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                            }`}>
                              {formatDistanceToNow(new Date(message.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                {!["completed", "cancelled"].includes(trade.status) && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        disabled={sending}
                      />
                      <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Dispute Dialog */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise a Dispute</DialogTitle>
            <DialogDescription>
              Please describe the issue with this trade. An admin will review and resolve the dispute.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe the problem..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDispute}
              disabled={!disputeReason.trim() || actionLoading}
            >
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradePage;
