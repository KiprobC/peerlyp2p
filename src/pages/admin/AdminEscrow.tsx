import { useState } from "react";
import { useAdminTrades, AdminTrade } from "@/hooks/useAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatsCard } from "@/components/admin/StatsCard";
import { DataTable } from "@/components/admin/DataTable";
import { Lock, Unlock, AlertTriangle, CheckCircle, XCircle, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export const AdminEscrow = () => {
  const { trades, loading, releaseEscrow, lockEscrow, cancelTrade, refetch } = useAdminTrades();
  const { toast } = useToast();
  
  const [selectedTrade, setSelectedTrade] = useState<AdminTrade | null>(null);
  const [actionType, setActionType] = useState<"release" | "lock" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter trades with escrow relevance
  const escrowTrades = trades.filter(t => 
    ["pending", "confirmed", "payment_sent", "disputed"].includes(t.status)
  );

  const lockedEscrowTrades = escrowTrades.filter(t => t.escrow_locked && !t.escrow_released);
  const pendingEscrowTrades = escrowTrades.filter(t => !t.escrow_locked && !t.escrow_released);
  const disputedTrades = trades.filter(t => t.status === "disputed");

  const totalLockedValue = lockedEscrowTrades.reduce((sum, t) => sum + Number(t.crypto_amount), 0);

  const filteredTrades = escrowTrades.filter(t => 
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.crypto_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = async () => {
    if (!selectedTrade || !actionType) return;
    
    setProcessing(true);
    let result;

    switch (actionType) {
      case "release":
        result = await releaseEscrow(selectedTrade.id);
        break;
      case "lock":
        result = await lockEscrow(selectedTrade.id);
        break;
      case "cancel":
        result = await cancelTrade(selectedTrade.id, reason);
        break;
    }

    if (result?.error) {
      toast({ title: "Action failed", description: String(result.error), variant: "destructive" });
    } else {
      toast({ title: `Escrow ${actionType}d successfully` });
    }

    setProcessing(false);
    setSelectedTrade(null);
    setActionType(null);
    setReason("");
  };

  const getStatusBadge = (trade: AdminTrade) => {
    if (trade.escrow_released) {
      return <Badge className="bg-green-500/20 text-green-500">Released</Badge>;
    }
    if (trade.status === "disputed") {
      return <Badge variant="destructive">Disputed</Badge>;
    }
    if (trade.escrow_locked) {
      return <Badge className="bg-yellow-500/20 text-yellow-500">Locked</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const columns = [
    {
      key: "id",
      header: "Trade ID",
      render: (t: AdminTrade) => (
        <span className="font-mono text-xs">{t.id.slice(0, 8)}...</span>
      ),
    },
    {
      key: "crypto",
      header: "Amount",
      render: (t: AdminTrade) => (
        <div>
          <span className="font-semibold">{Number(t.crypto_amount).toFixed(6)}</span>
          <span className="text-muted-foreground ml-1">{t.crypto_type}</span>
        </div>
      ),
    },
    {
      key: "fiat",
      header: "Fiat Value",
      render: (t: AdminTrade) => (
        <span>{t.fiat_currency} {Number(t.fiat_amount).toLocaleString()}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t: AdminTrade) => getStatusBadge(t),
    },
    {
      key: "escrow",
      header: "Escrow State",
      render: (t: AdminTrade) => (
        <div className="flex items-center gap-2">
          {t.escrow_locked ? (
            <Lock className="h-4 w-4 text-yellow-500" />
          ) : (
            <Unlock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm">
            {t.escrow_released ? "Released" : t.escrow_locked ? "Locked" : "Pending"}
          </span>
        </div>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (t: AdminTrade) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (t: AdminTrade) => (
        <div className="flex items-center gap-2">
          {!t.escrow_released && t.status !== "cancelled" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                onClick={() => {
                  setSelectedTrade(t);
                  setActionType("release");
                }}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Release
              </Button>
              {!t.escrow_locked && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10"
                  onClick={() => {
                    setSelectedTrade(t);
                    setActionType("lock");
                  }}
                >
                  <Lock className="h-3 w-3 mr-1" />
                  Lock
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setSelectedTrade(t);
                  setActionType("cancel");
                }}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </>
          )}
          {t.escrow_released && (
            <span className="text-xs text-muted-foreground">Completed</span>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Escrow Management</h1>
        <p className="text-muted-foreground">Manage and control trade escrow funds</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Active Escrows"
          value={escrowTrades.length}
          icon={Lock}
          variant="primary"
        />
        <StatsCard
          title="Locked Escrows"
          value={lockedEscrowTrades.length}
          icon={Lock}
          variant="warning"
        />
        <StatsCard
          title="Pending Release"
          value={pendingEscrowTrades.length}
          icon={Unlock}
          variant="success"
        />
        <StatsCard
          title="Disputed"
          value={disputedTrades.length}
          icon={AlertTriangle}
          variant="destructive"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-yellow-500" />
              Total Locked Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalLockedValue.toFixed(6)}</p>
            <p className="text-xs text-muted-foreground">Across all crypto types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Requires Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{disputedTrades.length}</p>
            <p className="text-xs text-muted-foreground">Disputed trades needing review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Ready to Release
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {escrowTrades.filter(t => t.status === "payment_sent").length}
            </p>
            <p className="text-xs text-muted-foreground">Payment confirmed, awaiting release</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by Trade ID, crypto type, or status..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Escrow Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Escrow Trades</CardTitle>
          <CardDescription>Manage escrow for ongoing trades</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable data={filteredTrades} columns={columns} loading={loading} />
        </CardContent>
      </Card>

      {/* Release Confirmation Dialog */}
      <AlertDialog open={actionType === "release"} onOpenChange={() => setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release Escrow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will release {selectedTrade?.crypto_amount} {selectedTrade?.crypto_type} to the buyer.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className="bg-green-600 hover:bg-green-700"
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Release Funds
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lock Confirmation Dialog */}
      <AlertDialog open={actionType === "lock"} onOpenChange={() => setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock Escrow for Investigation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will lock the escrow and mark the trade as disputed for investigation.
              The funds will remain locked until you release or cancel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className="bg-yellow-600 hover:bg-yellow-700"
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Lock Escrow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Trade Dialog */}
      <Dialog open={actionType === "cancel"} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Trade & Return Funds</DialogTitle>
            <DialogDescription>
              This will cancel the trade and return {selectedTrade?.crypto_amount} {selectedTrade?.crypto_type} to the seller.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Cancellation Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for cancellation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleAction}
              disabled={processing || !reason.trim()}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Cancel Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
