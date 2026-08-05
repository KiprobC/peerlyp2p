import { useState } from "react";
import { useModeration } from "@/hooks/useModeration";
import { useAdminTradeMessages } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Clock, Users, MessageSquare, FileText, Shield, Scale } from "lucide-react";
import { format } from "date-fns";
import { RatingsModerationPanel } from "@/components/admin/RatingsModerationPanel";


interface DisputeMessagesProps {
  tradeId: string;
}

const DisputeMessages = ({ tradeId }: DisputeMessagesProps) => {
  const { messages, loading } = useAdminTradeMessages(tradeId);

  if (loading) return <div className="text-center py-4">Loading messages...</div>;

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2 p-2">
        {messages.map((msg: any) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg ${msg.is_system ? 'bg-muted text-center text-sm' : 'bg-card border'}`}
          >
            {!msg.is_system && (
              <p className="text-xs text-muted-foreground mb-1">
                @{msg.sender_username || msg.sender_id.slice(0, 8)} • {format(new Date(msg.created_at), 'HH:mm')}
              </p>
            )}
            <p className={msg.is_system ? 'text-muted-foreground' : ''}>{msg.message}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export const AdminModeration = () => {
  const { disputes, adminActions, auditTrails, moderators, loading, assignDispute, resolveDispute, updateDisputeStatus, fetchAuditTrails } = useModeration();
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [resolveDialog, setResolveDialog] = useState(false);
  const [selectedModerator, setSelectedModerator] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [resolutionType, setResolutionType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const pendingDisputes = disputes.filter(d => d.status === 'assigned' || d.status === 'in_review');
  const resolvedDisputes = disputes.filter(d => d.status === 'resolved');

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "secondary",
      normal: "default",
      high: "destructive",
      critical: "destructive"
    };
    return <Badge variant={variants[priority] || "default"}>{priority.toUpperCase()}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      assigned: { variant: "secondary", icon: Clock },
      in_review: { variant: "default", icon: FileText },
      resolved: { variant: "outline", icon: CheckCircle },
      escalated: { variant: "destructive", icon: AlertTriangle }
    };
    const { variant, icon: Icon } = config[status] || { variant: "default", icon: Clock };
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const handleAssign = async () => {
    if (!selectedDispute || !selectedModerator) return;
    setProcessing(true);
    await assignDispute(selectedDispute.trade_id, selectedModerator, priority, notes);
    setProcessing(false);
    setAssignDialog(false);
    setSelectedModerator("");
    setNotes("");
  };

  const handleResolve = async () => {
    if (!selectedDispute || !resolutionType || !notes) return;
    setProcessing(true);
    await resolveDispute(selectedDispute.trade_id, resolutionType, notes);
    setProcessing(false);
    setResolveDialog(false);
    setResolutionType("");
    setNotes("");
  };

  const openDisputeDetails = async (dispute: any) => {
    setSelectedDispute(dispute);
    await fetchAuditTrails(dispute.trade_id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Moderation Center</h1>
        <p className="text-muted-foreground">Manage disputes, review trades, and audit actions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{pendingDisputes.length}</p>
                <p className="text-sm text-muted-foreground">Pending Disputes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{resolvedDisputes.length}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{moderators.length}</p>
                <p className="text-sm text-muted-foreground">Moderators</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{adminActions.length}</p>
                <p className="text-sm text-muted-foreground">Actions Logged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="disputes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="ratings">Ratings</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="moderators">Moderators</TabsTrigger>
        </TabsList>

        {/* Ratings Tab */}
        <TabsContent value="ratings">
          <RatingsModerationPanel />
        </TabsContent>


        {/* Disputes Tab */}
        <TabsContent value="disputes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Disputes</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingDisputes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pending disputes</p>
              ) : (
                <div className="space-y-3">
                  {pendingDisputes.map(dispute => (
                    <div key={dispute.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">Trade #{dispute.trade_id.slice(0, 8)}</span>
                          {getStatusBadge(dispute.status)}
                          {getPriorityBadge(dispute.priority)}
                        </div>
                        {dispute.trade && (
                          <p className="text-sm text-muted-foreground">
                            {dispute.trade.crypto_amount} {dispute.trade.crypto_type} • 
                            KES {dispute.trade.fiat_amount.toLocaleString()}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Assigned to: {dispute.assignee?.full_name || dispute.assignee?.username || 'Unknown'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDisputeDetails(dispute)}>
                          View Details
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedDispute(dispute); setAssignDialog(true); }}>
                          Reassign
                        </Button>
                        <Button size="sm" onClick={() => { setSelectedDispute(dispute); setResolveDialog(true); }}>
                          Resolve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dispute Details */}
          {selectedDispute && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Dispute Details - Trade #{selectedDispute.trade_id.slice(0, 8)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="messages">
                  <TabsList>
                    <TabsTrigger value="messages">
                      <MessageSquare className="h-4 w-4 mr-1" /> Messages
                    </TabsTrigger>
                    <TabsTrigger value="audit">
                      <FileText className="h-4 w-4 mr-1" /> Audit Trail
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="messages">
                    <DisputeMessages tradeId={selectedDispute.trade_id} />
                  </TabsContent>
                  <TabsContent value="audit">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {auditTrails.filter(a => a.trade_id === selectedDispute.trade_id).map(trail => (
                          <div key={trail.id} className="p-3 rounded-lg bg-muted/50 border">
                            <div className="flex items-center justify-between mb-2">
                              <Badge>{trail.action_type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(trail.created_at), 'MMM d, HH:mm')}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Seller Balance</p>
                                <p>{trail.seller_balance_before?.toFixed(6)} → {trail.seller_balance_after?.toFixed(6)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Buyer Balance</p>
                                <p>{trail.buyer_balance_before?.toFixed(6)} → {trail.buyer_balance_after?.toFixed(6)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Seller Locked</p>
                                <p>{trail.seller_locked_before?.toFixed(6)} → {trail.seller_locked_after?.toFixed(6)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Escrow Amount</p>
                                <p>{trail.escrow_amount?.toFixed(6)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Action Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {adminActions.map(action => (
                    <div key={action.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{action.action_type}</Badge>
                          <Badge variant="secondary">{action.target_type}</Badge>
                          <Badge>{action.actor_role}</Badge>
                        </div>
                        {action.reason && (
                          <p className="text-sm text-muted-foreground mt-1">{action.reason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(action.created_at), 'MMM d, yyyy HH:mm:ss')}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground">
                          Actor: {action.actor_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Moderators Tab */}
        <TabsContent value="moderators">
          <Card>
            <CardHeader>
              <CardTitle>Moderators & Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {moderators.map(mod => (
                  <div key={mod.user_id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{mod.profile?.full_name || mod.profile?.username || 'Unknown'}</p>
                        <Badge variant={mod.role === 'admin' ? 'default' : 'secondary'}>{mod.role}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Moderator to Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Moderator</label>
              <Select value={selectedModerator} onValueChange={setSelectedModerator}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose moderator..." />
                </SelectTrigger>
                <SelectContent>
                  {moderators.map(mod => (
                    <SelectItem key={mod.user_id} value={mod.user_id}>
                      {mod.profile?.full_name || mod.profile?.username} ({mod.role})
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
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={processing || !selectedModerator}>
              {processing ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <SelectValue placeholder="Choose resolution..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="release_to_buyer">Release to Buyer</SelectItem>
                  <SelectItem value="release_to_seller">Return to Seller</SelectItem>
                  <SelectItem value="split">Split 50/50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Resolution Notes (Required)</label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Explain the resolution decision..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog(false)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={processing || !resolutionType || !notes}>
              {processing ? 'Resolving...' : 'Resolve Dispute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
