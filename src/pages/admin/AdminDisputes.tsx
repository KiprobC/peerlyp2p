import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, MessageSquare, Clock, User, FileText } from "lucide-react";
import { useAdminTrades, useAdminTradeMessages } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

const DisputeMessages = ({ tradeId }: { tradeId: string }) => {
  const { messages, loading } = useAdminTradeMessages(tradeId);

  if (loading) {
    return <p className="text-center text-muted-foreground py-4">Loading messages...</p>;
  }

  if (messages.length === 0) {
    return <p className="text-center text-muted-foreground py-4">No messages in this trade</p>;
  }

  return (
    <ScrollArea className="h-48 rounded-lg border border-border p-3">
      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-2 rounded-lg text-sm ${
              msg.is_system ? "bg-accent/10 text-accent" : "bg-secondary/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <User className="h-3 w-3" />
              <span className="font-mono text-xs">{msg.sender_id.slice(0, 8)}...</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(msg.created_at), "MMM dd, HH:mm")}
              </span>
            </div>
            <p>{msg.message}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export const AdminDisputes = () => {
  const { disputedTrades, loading, releaseEscrow, cancelTrade } = useAdminTrades();
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"buyer" | "seller" | null>(null);
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [viewingMessages, setViewingMessages] = useState<string | null>(null);

  const handleResolve = async () => {
    if (!selectedTrade || !resolution) return;

    setResolving(true);
    let result;

    if (resolution === "buyer") {
      result = await releaseEscrow(selectedTrade);
    } else {
      result = await cancelTrade(selectedTrade, `Admin resolution: Returned to seller. Notes: ${notes}`);
    }

    setResolving(false);

    if (result.error) {
      toast.error("Failed to resolve dispute");
    } else {
      toast.success(`Dispute resolved: Crypto ${resolution === "buyer" ? "released to buyer" : "returned to seller"}`);
      setSelectedTrade(null);
      setResolution(null);
      setNotes("");
    }
  };

  const selectedTradeData = disputedTrades.find((t) => t.id === selectedTrade);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Dispute Resolution Center</h1>
        <p className="text-muted-foreground">Review evidence and resolve trade disputes</p>
      </div>

      {disputedTrades.length === 0 ? (
        <div className="glass-card text-center py-12">
          <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Active Disputes</h2>
          <p className="text-muted-foreground">All trade disputes have been resolved</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {disputedTrades.map((trade) => (
            <div
              key={trade.id}
              className="glass-card border border-destructive/20"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Trade #{trade.id.slice(0, 8)}</h3>
                      <p className="text-sm text-muted-foreground">
                        Disputed {formatDistanceToNow(new Date(trade.disputed_at || trade.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="destructive">Disputed</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium">{trade.crypto_amount} {trade.crypto_type}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Value</p>
                    <p className="font-medium">{trade.fiat_currency} {trade.fiat_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Buyer</p>
                    <p className="font-mono text-xs">{trade.buyer_id.slice(0, 12)}...</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Seller</p>
                    <p className="font-mono text-xs">{trade.seller_id.slice(0, 12)}...</p>
                  </div>
                </div>

                {trade.dispute_reason && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                      <FileText className="h-3 w-3" />
                      Dispute Reason
                    </p>
                    <p className="text-sm">{trade.dispute_reason}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingMessages(trade.id)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    View Chat History
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setSelectedTrade(trade.id);
                      setResolution("buyer");
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Release to Buyer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedTrade(trade.id);
                      setResolution("seller");
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Return to Seller
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Chat History Dialog */}
      <Dialog open={!!viewingMessages} onOpenChange={() => setViewingMessages(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Trade Chat History</DialogTitle>
            <DialogDescription>
              Review the conversation between buyer and seller
            </DialogDescription>
          </DialogHeader>
          {viewingMessages && <DisputeMessages tradeId={viewingMessages} />}
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolution === "buyer" ? "Release Funds to Buyer" : "Return Funds to Seller"}
            </DialogTitle>
            <DialogDescription>
              This action will {resolution === "buyer" ? "complete" : "cancel"} the trade and{" "}
              {resolution === "buyer"
                ? "release the escrowed crypto to the buyer"
                : "return the escrowed crypto to the seller"}.
            </DialogDescription>
          </DialogHeader>

          {selectedTradeData && (
            <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trade ID</span>
                <span className="font-mono text-sm">{selectedTradeData.id.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span>{selectedTradeData.crypto_amount} {selectedTradeData.crypto_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Value</span>
                <span>{selectedTradeData.fiat_currency} {selectedTradeData.fiat_amount.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">Resolution Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document your decision and reasoning..."
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTrade(null)}>
              Cancel
            </Button>
            <Button
              variant={resolution === "buyer" ? "default" : "destructive"}
              onClick={handleResolve}
              disabled={resolving}
            >
              {resolving
                ? "Processing..."
                : resolution === "buyer"
                ? "Release to Buyer"
                : "Return to Seller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
