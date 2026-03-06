import { useState } from "react";
import { useModeratorDisputes, useModeratorTradeMessages } from "@/hooks/useModeratorRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SLATimer } from "@/components/moderator/SLATimer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  User, 
  Star,
  TrendingUp,
  HandMetal,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface MessageViewerProps {
  tradeId: string;
}

const MessageViewer = ({ tradeId }: MessageViewerProps) => {
  const { messages, loading } = useModeratorTradeMessages(tradeId);

  if (loading) {
    return <div className="text-center py-4">Loading messages...</div>;
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 p-2">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No messages</p>
        ) : (
          messages.map((msg: any) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${
                msg.is_system
                  ? "bg-muted text-center text-sm"
                  : "bg-card border"
              }`}
            >
              {!msg.is_system && (
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={msg.sender_avatar} />
                    <AvatarFallback>
                      <User className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium">
                    @{msg.sender_username || "unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.created_at), "HH:mm")}
                  </span>
                </div>
              )}
              <p className={msg.is_system ? "text-muted-foreground" : ""}>
                {msg.message}
              </p>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
};

export const ModeratorDisputes = () => {
  const { user } = useAuth();
  const { disputes, pendingDisputes, resolvedDisputes, loading, resolveDispute, updateStatus } =
    useModeratorDisputes();
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [resolveDialog, setResolveDialog] = useState(false);
  const [resolutionType, setResolutionType] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const handleSelfAssign = async (dispute: any) => {
    if (!user) return;
    setAssigning(dispute.id);
    try {
      // Check if already assigned
      if (dispute.assigned_to && dispute.assigned_to !== "00000000-0000-0000-0000-000000000000") {
        toast.error("This dispute is already assigned to a moderator");
        return;
      }
      
      const { error } = await supabase.rpc('assign_dispute_moderator', {
        p_trade_id: dispute.trade_id,
        p_moderator_id: user.id,
        p_priority: dispute.priority || 'normal',
        p_notes: 'Self-assigned from dispute queue'
      });

      if (error) throw error;
      toast.success("Dispute assigned to you");
    } catch (error: any) {
      // If dispute already has assignment, try updating it
      const { error: updateError } = await supabase
        .from("dispute_assignments")
        .update({ 
          assigned_to: user.id, 
          updated_at: new Date().toISOString() 
        })
        .eq("trade_id", dispute.trade_id)
        .is("assigned_to", null);

      if (updateError) {
        toast.error("Failed to assign dispute: " + (error.message || "Unknown error"));
      } else {
        toast.success("Dispute assigned to you");
      }
    } finally {
      setAssigning(null);
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute || !resolutionType || !notes.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setProcessing(true);
    const { error } = await resolveDispute(selectedDispute.trade_id, resolutionType, notes);
    setProcessing(false);

    if (error) {
      toast.error("Failed to resolve dispute");
    } else {
      toast.success("Dispute resolved successfully");
      setResolveDialog(false);
      setSelectedDispute(null);
      setResolutionType("");
      setNotes("");
    }
  };

  const handleMarkInReview = async (dispute: any) => {
    const { error } = await updateStatus(dispute.trade_id, "in_review");
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Dispute marked as in review");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
      case "high":
        return "destructive";
      case "normal":
        return "default";
      default:
        return "secondary";
    }
  };

  const isAssignedToMe = (dispute: any) => dispute.assigned_to === user?.id;
  const isUnassigned = (dispute: any) => !dispute.assigned_to;

  const TraderCard = ({ trader, role }: { trader: any; role: string }) => (
    <div className="p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={trader?.avatar_url} />
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-sm">@{trader?.username || "unknown"}</p>
          <Badge variant="outline" className="text-xs">{role}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
          </div>
          <p className="font-medium">{trader?.successful_trades || 0}/{trader?.total_trades || 0}</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Star className="h-3 w-3" />
          </div>
          <p className="font-medium text-yellow-500">★ {(trader?.rating || 0).toFixed(1)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Rate</p>
          <p className="font-medium">
            {trader?.total_trades > 0
              ? Math.round((trader.successful_trades / trader.total_trades) * 100)
              : 0}
            %
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Dispute Queue</h1>
        <p className="text-muted-foreground">All active disputes — pick one to resolve</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Active ({pendingDisputes.length})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Resolved ({resolvedDisputes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingDisputes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500/50" />
                <p className="text-muted-foreground">No active disputes</p>
              </CardContent>
            </Card>
          ) : (
            pendingDisputes.map((dispute) => (
              <Card key={dispute.id} className={isAssignedToMe(dispute) ? "border-primary/50" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      Trade #{dispute.trade_id.slice(0, 8)}
                      {isAssignedToMe(dispute) && (
                        <Badge variant="default" className="text-xs">Assigned to you</Badge>
                      )}
                      {!isAssignedToMe(dispute) && !isUnassigned(dispute) && (
                        <Badge variant="secondary" className="text-xs">Assigned to other</Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <SLATimer
                        slaDeadline={(dispute as any).sla_deadline}
                        firstResponseAt={(dispute as any).first_response_at}
                        slaBreached={(dispute as any).sla_breached || false}
                        escalated={(dispute as any).escalated || false}
                        compact
                      />
                      <Badge variant={getPriorityColor(dispute.priority) as any}>
                        {dispute.priority}
                      </Badge>
                      {(dispute as any).escalated && (
                        <Badge variant="destructive">Escalated</Badge>
                      )}
                      <Badge variant={dispute.status === "in_review" ? "default" : "secondary"}>
                        {dispute.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Trade Info */}
                  {dispute.trade && (
                    <div className="p-4 rounded-lg bg-muted/30 border">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-medium">
                            {dispute.trade.crypto_amount} {dispute.trade.crypto_type}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Value</p>
                          <p className="font-medium">
                            {dispute.trade.fiat_currency} {dispute.trade.fiat_amount.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment</p>
                          <p className="font-medium">{dispute.trade.payment_method}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Opened</p>
                          <p className="font-medium">
                            {formatDistanceToNow(new Date(dispute.trade.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {dispute.trade.dispute_reason && (
                        <div className="mt-3 pt-3 border-t space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-muted-foreground">Disputed by:</p>
                            <Badge variant="outline" className="text-xs">
                              @{dispute.trade.disputed_by === dispute.trade.buyer_id
                                ? (dispute.buyer?.username || "unknown") + " (Buyer)"
                                : (dispute.seller?.username || "unknown") + " (Seller)"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">Reason:</p>
                          <p className="text-sm">{dispute.trade.dispute_reason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Traders */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TraderCard trader={dispute.buyer} role="Buyer" />
                    <TraderCard trader={dispute.seller} role="Seller" />
                  </div>

                  {/* Messages - visible to any moderator */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="font-medium">Trade Chat</span>
                    </div>
                    <MessageViewer tradeId={dispute.trade_id} />
                  </div>

                  {/* Actions - any moderator can act */}
                  <div className="flex gap-2 pt-4 border-t flex-wrap">
                    {!isAssignedToMe(dispute) && (
                      <Button 
                        variant="outline" 
                        onClick={() => handleSelfAssign(dispute)}
                        disabled={assigning === dispute.id}
                      >
                        <HandMetal className="w-4 h-4 mr-2" />
                        {assigning === dispute.id ? "Assigning..." : "Pick This Dispute"}
                      </Button>
                    )}
                    {dispute.status === "assigned" && (
                      <Button variant="outline" onClick={() => handleMarkInReview(dispute)}>
                        Mark In Review
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setSelectedDispute(dispute);
                        setResolveDialog(true);
                      }}
                    >
                      Resolve Dispute
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {resolvedDisputes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No resolved disputes yet</p>
              </CardContent>
            </Card>
          ) : (
            resolvedDisputes.map((dispute) => (
              <Card key={dispute.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-mono text-sm">
                          Trade #{dispute.trade_id.slice(0, 8)}
                        </span>
                        <Badge variant="outline">{dispute.resolution_type}</Badge>
                      </div>
                      {dispute.trade && (
                        <p className="text-sm text-muted-foreground">
                          {dispute.trade.crypto_amount} {dispute.trade.crypto_type} •{" "}
                          {dispute.trade.fiat_currency} {dispute.trade.fiat_amount.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Resolved {dispute.resolved_at && formatDistanceToNow(new Date(dispute.resolved_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialog} onOpenChange={setResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Resolution Type</label>
              <Select value={resolutionType} onValueChange={setResolutionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select resolution..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="release_to_buyer">Release to Buyer</SelectItem>
                  <SelectItem value="refund_to_seller">Refund to Seller</SelectItem>
                  <SelectItem value="split_50_50">Split 50/50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Explain the resolution decision..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={processing || !resolutionType || !notes.trim()}>
              {processing ? "Resolving..." : "Confirm Resolution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
