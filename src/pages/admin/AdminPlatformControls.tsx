import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Power, Shield, Users, Wallet, ArrowLeftRight, Package, RefreshCw } from "lucide-react";
import { usePlatformSettings, useFrozenUsers } from "@/hooks/usePlatformControls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const settingIcons: Record<string, React.ReactNode> = {
  trading_enabled: <ArrowLeftRight className="h-4 w-4" />,
  offer_creation_enabled: <Package className="h-4 w-4" />,
  trade_initiation_enabled: <Shield className="h-4 w-4" />,
  escrow_locking_enabled: <Wallet className="h-4 w-4" />,
  wallet_transfers_enabled: <Wallet className="h-4 w-4" />,
};

const settingLabels: Record<string, string> = {
  trading_enabled: "P2P Trading",
  offer_creation_enabled: "Offer Creation",
  trade_initiation_enabled: "Trade Initiation",
  escrow_locking_enabled: "Escrow Locking",
  wallet_transfers_enabled: "Wallet Transfers",
};

export default function AdminPlatformControls() {
  const { settings, loading, toggleSetting, refetch } = usePlatformSettings();
  const { frozenUsers, loading: frozenLoading, freezeUser, unfreezeUser } = useFrozenUsers();
  
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [freezeUserId, setFreezeUserId] = useState("");
  const [freezeReason, setFreezeReason] = useState("");
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; enabled: boolean } | null>(null);

  const handleToggle = async (settingId: string, newValue: boolean) => {
    // Confirm before disabling critical features
    if (!newValue) {
      setConfirmToggle({ id: settingId, enabled: newValue });
    } else {
      await toggleSetting(settingId, newValue);
    }
  };

  const confirmToggleAction = async () => {
    if (confirmToggle) {
      await toggleSetting(confirmToggle.id, confirmToggle.enabled);
      setConfirmToggle(null);
    }
  };

  const handleFreezeUser = async () => {
    if (freezeUserId) {
      await freezeUser(freezeUserId, freezeReason);
      setFreezeDialogOpen(false);
      setFreezeUserId("");
      setFreezeReason("");
    }
  };

  const disabledCount = settings.filter(s => !s.value.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Platform Controls</h1>
          <p className="text-xs text-muted-foreground">Emergency kill switches and system controls</p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      {disabledCount > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Features Disabled</AlertTitle>
          <AlertDescription>
            {disabledCount} platform feature(s) are currently disabled. Users may be unable to trade.
          </AlertDescription>
        </Alert>
      )}

      {/* Global Kill Switches */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Power className="h-4 w-4" />
            Global Kill Switches
          </CardTitle>
          <CardDescription className="text-xs">
            Instantly enable/disable platform features. Changes take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))
          ) : (
            settings.map((setting) => (
              <div
                key={setting.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded ${setting.value.enabled ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}`}>
                    {settingIcons[setting.id] || <Power className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{settingLabels[setting.id] || setting.id}</div>
                    <div className="text-xs text-muted-foreground">{setting.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={setting.value.enabled ? "default" : "destructive"} className="text-xs">
                    {setting.value.enabled ? "ON" : "OFF"}
                  </Badge>
                  <Switch
                    checked={setting.value.enabled}
                    onCheckedChange={(checked) => handleToggle(setting.id, checked)}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Per-User Kill Switch */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Frozen Users
              </CardTitle>
              <CardDescription className="text-xs">
                Instantly block suspicious accounts from all trading activity
              </CardDescription>
            </div>
            <Dialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Shield className="h-3 w-3 mr-1" />
                  Freeze User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Freeze User Account</DialogTitle>
                  <DialogDescription>
                    This will immediately block the user from all trading activities.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">User ID</Label>
                    <Input
                      placeholder="Enter user UUID"
                      value={freezeUserId}
                      onChange={(e) => setFreezeUserId(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Reason (optional)</Label>
                    <Textarea
                      placeholder="Reason for freezing..."
                      value={freezeReason}
                      onChange={(e) => setFreezeReason(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setFreezeDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleFreezeUser}>
                    Freeze Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {frozenLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : frozenUsers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No frozen users
            </div>
          ) : (
            <div className="space-y-2">
              {frozenUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 rounded border bg-destructive/5"
                >
                  <div>
                    <div className="font-mono text-xs">{user.user_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {user.reason || "No reason provided"} • Frozen {new Date(user.frozen_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unfreezeUser(user.user_id)}
                  >
                    Unfreeze
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmToggle} onOpenChange={() => setConfirmToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Disable {confirmToggle && settingLabels[confirmToggle.id]}?
            </DialogTitle>
            <DialogDescription>
              This will immediately prevent all users from using this feature.
              Active trades will continue but no new ones can be started.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmToggle(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmToggleAction}>
              Yes, Disable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
