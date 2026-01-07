import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, MessageSquare, Clock, User, FileText, Lock, Unlock, Star, ArrowRightLeft, Scale } from "lucide-react";
import { useAdminTrades, useAdminTradeMessages, useAdminTradeDetails } from "@/hooks/useAdmin";
import { useModeration } from "@/hooks/useModeration";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DisputeMessages = ({ tradeId }: { tradeId: string }) => {
  const { messages, loading } = useAdminTradeMessages(tradeId);

  if (loading) {
    return <p className="text-center text-muted-foreground py-4">Loading messages...</p>;
  }

  if (messages.length === 0) {
    return <p className="text-center text-muted-foreground py-4">No messages in this trade</p>;
  }

  return (
    <ScrollArea className="h-64 rounded-lg border border-border p-3">
      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg text-sm ${
              msg.is_system 
                ? "bg-accent/10 text-accent border border-accent/20" 
                : "bg-secondary/50"
            }`}
          >
            {!msg.is_system && (
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={msg.sender_avatar || undefined} />
                  <AvatarFallback className="text-xs bg-primary/20">
                    {msg.sender_username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">@{msg.sender_username}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(msg.created_at), "MMM dd, HH:mm")}
                </span>
              </div>
            )}
            {msg.is_system && (
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">System</Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(msg.created_at), "MMM dd, HH:mm")}
                </span>
              </div>
            )}
            <p className={msg.is_system ? 'text-sm' : ''}>{msg.message}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

const TraderCard = ({ 
  label, 
  username, 
  rating, 
  trades 
}: { 
  label: string; 
  username: string; 
  rating: number; 
  trades: number;
}) => (
  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className="font-medium">@{username}</p>
    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Star className="h-3 w-3 text-yellow-500" />
        {rating?.toFixed(1) || '0.0'}
      </span>
      <span className="flex items-center gap-1">
        <ArrowRightLeft className="h-3 w-3" />
        {trades} trades
      </span>
    </div>
  </div>
);

export const AdminDisputes = () => {
  const { disputedTrades, loading, refetch } = useAdminTrades();
  const { resolveDispute, moderators, assignDispute } = useModeration();
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const [viewingMessages, setViewingMessages] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState<string | null>(null);
  const [selectedModerator, setSelectedModerator] = useState("");
  const [priority, setPriority] = useState("normal");

  const { trade: selectedTradeData } = useAdminTradeDetails(selectedTradeId || "");

  const handleResolve = async () => {
    if (!selectedTradeId || !resolution || !notes) {
      toast.error("Please select a resolution and provide notes");
      return;
    }

    setResolving(true);
    const success = await resolveDispute(selectedTradeId, resolution, notes);
    setResolving(false);

    if (success) {
      toast.success(`Dispute resolved: ${resolution.replace(/_/g, ' ')}`);
      setSelectedTradeId(null);
      setResolution("");
      setNotes("");
      refetch();
    }
  };

  const handleAssign = async () => {
    if (!assignDialog || !selectedModerator) return;
    await assignDispute(assignDialog, selectedModerator, priority);
    setAssignDialog(null);
    setSelectedModerator("");
  };

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
        <p className="text-muted-foreground">Review evidence and resolve trade disputes fairly</p>
      </div>

      {disputedTrades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Active Disputes</h2>
            <p className="text-muted-foreground">All trade disputes have been resolved</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {disputedTrades.map((trade) => (
            <Card key={trade.id} className="border-destructive/30">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  {/* Header */}
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
                    <div className="flex items-center gap-2">
                      {/* Escrow Status Badge */}
                      {trade.escrow_locked && !trade.escrow_released ? (
                        <Badge variant="outline" className="flex items-center gap-1 border-warning text-warning">
                          <Lock className="h-3 w-3" />
                          Escrow Locked
                        </Badge>
                      ) : trade.escrow_released ? (
                        <Badge variant="outline" className="flex items-center gap-1 border-primary text-primary">
                          <Unlock className="h-3 w-3" />
                          Escrow Released
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No Escrow</Badge>
                      )}
                      <Badge variant="destructive">Disputed</Badge>
                    </div>
                  </div>

                  {/* Trade Details */}
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
                      <p className="text-muted-foreground">Payment</p>
                      <p className="font-medium">{trade.payment_method}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{format(new Date(trade.created_at), "MMM dd, yyyy")}</p>
                    </div>
                  </div>

                  {/* Dispute Reason */}
                  {trade.dispute_reason && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                        <FileText className="h-3 w-3" />
                        Dispute Reason
                      </p>
                      <p className="text-sm">{trade.dispute_reason}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingMessages(trade.id)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      View Chat
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssignDialog(trade.id)}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Assign Moderator
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setSelectedTradeId(trade.id)}
                    >
                      <Scale className="h-4 w-4 mr-2" />
                      Resolve Dispute
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Chat History Dialog */}
      <Dialog open={!!viewingMessages} onOpenChange={() => setViewingMessages(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trade Chat History</DialogTitle>
            <DialogDescription>
              Full conversation between buyer and seller
            </DialogDescription>
          </DialogHeader>
          {viewingMessages && <DisputeMessages tradeId={viewingMessages} />}
        </DialogContent>
      </Dialog>

      {/* Assign Moderator Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Moderator</DialogTitle>
            <DialogDescription>
              Assign a moderator to review this dispute
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Moderator</label>
              <Select value={selectedModerator} onValueChange={setSelectedModerator}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose moderator..." />
                </SelectTrigger>
                <SelectContent>
                  {moderators.map((mod) => (
                    <SelectItem key={mod.user_id} value={mod.user_id}>
                      {mod.profile?.full_name || mod.profile?.username || 'Unknown'} ({mod.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedModerator}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolution Dialog */}
      <Dialog open={!!selectedTradeId} onOpenChange={() => setSelectedTradeId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Make a fair decision based on the evidence and chat history
            </DialogDescription>
          </DialogHeader>

          {selectedTradeData && (
            <div className="space-y-4">
              {/* Trader Profiles */}
              <div className="grid grid-cols-2 gap-4">
                <TraderCard
                  label="Buyer"
                  username={selectedTradeData.buyer_username || 'Unknown'}
                  rating={selectedTradeData.buyer_rating || 0}
                  trades={selectedTradeData.buyer_trades || 0}
                />
                <TraderCard
                  label="Seller"
                  username={selectedTradeData.seller_username || 'Unknown'}
                  rating={selectedTradeData.seller_rating || 0}
                  trades={selectedTradeData.seller_trades || 0}
                />
              </div>

              {/* Trade Summary */}
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
                  <span>{selectedTradeData.fiat_currency} {selectedTradeData.fiat_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Escrow</span>
                  <Badge variant={selectedTradeData.escrow_locked ? "default" : "secondary"}>
                    {selectedTradeData.escrow_locked ? "Locked" : "Not Locked"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Resolution Decision</label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose resolution..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="release_to_buyer">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Release to Buyer
                    </div>
                  </SelectItem>
                  <SelectItem value="release_to_seller">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Return to Seller
                    </div>
                  </SelectItem>
                  <SelectItem value="split">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-warning" />
                      Split 50/50
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Resolution Notes (Required)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document your decision and reasoning for audit purposes..."
                className="mt-2 min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be logged in the audit trail and visible to both parties.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTradeId(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolving || !resolution || !notes}
            >
              {resolving ? "Processing..." : "Confirm Resolution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};