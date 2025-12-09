import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, MessageSquare, Clock } from "lucide-react";
import { useAdminTrades } from "@/hooks/useAdmin";
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
import { formatDistanceToNow } from "date-fns";

export const AdminDisputes = () => {
  const { disputedTrades, loading, resolveTrade } = useAdminTrades();
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"completed" | "cancelled" | null>(null);
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    if (!selectedTrade || !resolution) return;

    setResolving(true);
    const { error } = await resolveTrade(selectedTrade, resolution);
    setResolving(false);

    if (error) {
      toast.error("Failed to resolve dispute");
    } else {
      toast.success(`Dispute resolved: Trade ${resolution}`);
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
        <h1 className="text-3xl font-bold">Dispute Resolution</h1>
        <p className="text-muted-foreground">Review and resolve trade disputes</p>
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
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <h3 className="font-semibold">
                      Trade #{trade.id.slice(0, 8)}
                    </h3>
                    <Badge variant="destructive">Disputed</Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="font-medium">
                        {trade.crypto_amount} {trade.crypto_type}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Value</p>
                      <p className="font-medium">
                        {trade.fiat_currency} {trade.fiat_amount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Disputed</p>
                      <p className="font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(trade.disputed_at || trade.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Buyer ID</p>
                      <p className="font-mono text-xs">{trade.buyer_id.slice(0, 12)}...</p>
                    </div>
                  </div>

                  {trade.dispute_reason && (
                    <div className="mt-4 p-3 rounded-lg bg-secondary/50">
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                        <MessageSquare className="h-3 w-3" />
                        Dispute Reason
                      </p>
                      <p className="text-sm">{trade.dispute_reason}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 lg:flex-col">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedTrade(trade.id);
                      setResolution("completed");
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Release to Buyer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSelectedTrade(trade.id);
                      setResolution("cancelled");
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

      <Dialog open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolution === "completed" ? "Release Funds to Buyer" : "Return Funds to Seller"}
            </DialogTitle>
            <DialogDescription>
              This action will {resolution === "completed" ? "complete" : "cancel"} the trade and{" "}
              {resolution === "completed"
                ? "release the escrowed crypto to the buyer"
                : "return the escrowed crypto to the seller"}
              .
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
                <span>
                  {selectedTradeData.crypto_amount} {selectedTradeData.crypto_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Value</span>
                <span>
                  {selectedTradeData.fiat_currency} {selectedTradeData.fiat_amount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground">Resolution Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this resolution..."
              className="mt-2"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTrade(null)}>
              Cancel
            </Button>
            <Button
              variant={resolution === "completed" ? "default" : "destructive"}
              onClick={handleResolve}
              disabled={resolving}
            >
              {resolving
                ? "Processing..."
                : resolution === "completed"
                ? "Release Funds"
                : "Return Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
