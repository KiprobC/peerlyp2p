import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminTreasuryQueue, adminApproveDeposit, adminRejectDeposit, adminMarkWithdrawalSent, adminRejectWithdrawal } from "@/hooks/useManualTreasury";
import { RefreshCw, Check, X, Send, Plus, Wallet, RotateCw } from "lucide-react";

const AdminManualTreasury = () => {
  const { addresses, pendingDeposits, pendingWithdrawals, loading, refetch } = useAdminTreasuryQueue();
  const [addOpen, setAddOpen] = useState(false);
  const [newAddr, setNewAddr] = useState({ crypto_type: "BTC", network: "bitcoin", address: "", memo: "", memo_required: false, min_deposit: "0", label: "" });
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [approveForm, setApproveForm] = useState({ credited: "", tx: "", notes: "" });
  const [rejectTarget, setRejectTarget] = useState<{ kind: "deposit" | "withdrawal"; id: string } | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [sendTarget, setSendTarget] = useState<any>(null);
  const [sendForm, setSendForm] = useState({ tx: "", notes: "" });
  const [rotateTarget, setRotateTarget] = useState<any>(null);
  const [rotateForm, setRotateForm] = useState({ address: "", memo: "", memo_required: false, min_deposit: "0", label: "", notes: "" });
  const [tab, setTab] = useState("deposits");
  const activeAddresses = addresses.filter(a => a.is_active);
  const inactiveAddresses = addresses.filter(a => !a.is_active);

  const openApprove = (d: any) => {
    setApproveTarget(d);
    setApproveForm({ credited: String(d.amount), tx: d.tx_hash || "", notes: "" });
  };

  const runApprove = async () => {
    if (!approveTarget) return;
    try {
      await adminApproveDeposit(approveTarget.id, parseFloat(approveForm.credited), approveForm.tx, approveForm.notes);
      toast.success("Deposit approved and credited");
      setApproveTarget(null);
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const runReject = async () => {
    if (!rejectTarget) return;
    try {
      if (rejectTarget.kind === "deposit") await adminRejectDeposit(rejectTarget.id, rejectNotes);
      else await adminRejectWithdrawal(rejectTarget.id, rejectNotes);
      toast.success("Rejected");
      setRejectTarget(null); setRejectNotes("");
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const runSend = async () => {
    if (!sendTarget) return;
    if (!sendForm.tx || sendForm.tx.trim().length < 6) return toast.error("TX hash required");
    try {
      await adminMarkWithdrawalSent(sendTarget.id, sendForm.tx.trim(), sendForm.notes);
      toast.success("Withdrawal marked sent");
      setSendTarget(null); setSendForm({ tx: "", notes: "" });
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const addAddress = async () => {
    const { error } = await supabase.from("admin_deposit_addresses").insert({
      crypto_type: newAddr.crypto_type.toUpperCase(),
      network: newAddr.network.toLowerCase(),
      address: newAddr.address.trim(),
      memo: newAddr.memo.trim() || null,
      memo_required: newAddr.memo_required,
      min_deposit: parseFloat(newAddr.min_deposit) || 0,
      label: newAddr.label || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Deposit address added");
    setAddOpen(false);
    setNewAddr({ crypto_type: "BTC", network: "bitcoin", address: "", memo: "", memo_required: false, min_deposit: "0", label: "" });
    refetch();
  };

  const toggleAddress = async (id: string, active: boolean) => {
    const { error } = await supabase.from("admin_deposit_addresses").update({ is_active: active }).eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  };

  const runRotate = async () => {
    if (!rotateTarget) return;
    if (rotateForm.address.trim().length < 4) return toast.error("Enter the new address");
    const { error } = await supabase.rpc("admin_rotate_deposit_address", {
      p_old_id: rotateTarget.id,
      p_new_address: rotateForm.address.trim(),
      p_new_memo: rotateForm.memo || null,
      p_memo_required: rotateForm.memo_required,
      p_min_deposit: parseFloat(rotateForm.min_deposit) || 0,
      p_label: rotateForm.label || rotateTarget.label,
      p_notes: rotateForm.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Address rotated — old address deactivated");
    setRotateTarget(null);
    setRotateForm({ address: "", memo: "", memo_required: false, min_deposit: "0", label: "", notes: "" });
    refetch();
  };

  const pDeps = pendingDeposits.filter(d => d.status === "pending");
  const pWds = pendingWithdrawals.filter(w => w.status === "pending" || w.status === "approved");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> Manual Treasury</h1>
          <p className="text-muted-foreground text-sm">Manage deposit addresses and process pending deposits/withdrawals</p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="deposits">
        <TabsList>
          <TabsTrigger value="deposits">Pending Deposits <Badge className="ml-2">{pDeps.length}</Badge></TabsTrigger>
          <TabsTrigger value="withdrawals">Pending Withdrawals <Badge className="ml-2">{pWds.length}</Badge></TabsTrigger>
          <TabsTrigger value="addresses">Deposit Addresses</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="space-y-3">
          {pDeps.length === 0 && <p className="text-sm text-muted-foreground">No pending deposits.</p>}
          {pDeps.map(d => (
            <Card key={d.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{d.amount} {d.crypto_type} <span className="text-muted-foreground text-xs">on {d.network}</span></p>
                    <p className="text-xs text-muted-foreground">User: {d.user_id}</p>
                    <p className="text-xs text-muted-foreground">Submitted: {new Date(d.created_at).toLocaleString()}</p>
                    {d.tx_hash && <p className="text-xs font-mono break-all">TX: {d.tx_hash}</p>}
                    {d.memo && <p className="text-xs">Memo: {d.memo}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => openApprove(d)}><Check className="w-4 h-4 mr-1" /> Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectTarget({ kind: "deposit", id: d.id })}><X className="w-4 h-4 mr-1" /> Reject</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-3">
          {pWds.length === 0 && <p className="text-sm text-muted-foreground">No pending withdrawals.</p>}
          {pWds.map(w => (
            <Card key={w.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{w.amount} {w.crypto_type} <span className="text-muted-foreground text-xs">(+ {w.fee} fee)</span></p>
                    <p className="text-xs text-muted-foreground">To: <span className="font-mono">{w.destination_address}</span></p>
                    <p className="text-xs text-muted-foreground">User: {w.user_id} · {new Date(w.created_at).toLocaleString()}</p>
                    <p className="text-xs">Locked: {w.total_locked} {w.crypto_type} · Network: {w.network}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setSendTarget(w)}><Send className="w-4 h-4 mr-1" /> Mark Sent</Button>
                    <Button size="sm" variant="destructive" onClick={() => setRejectTarget({ kind: "withdrawal", id: w.id })}><X className="w-4 h-4 mr-1" /> Reject</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="addresses" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Address</Button>
          </div>
          {addresses.map(a => (
            <Card key={a.id}>
              <CardContent className="pt-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{a.crypto_type} <span className="text-muted-foreground text-xs">/ {a.network}</span></p>
                  <p className="text-xs font-mono break-all">{a.address}</p>
                  {a.memo && <p className="text-xs">Memo: {a.memo}{a.memo_required && " (required)"}</p>}
                  <p className="text-xs text-muted-foreground">Min: {a.min_deposit} {a.crypto_type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={a.is_active} onCheckedChange={c => toggleAddress(a.id, c)} />
                  <span className="text-xs">{a.is_active ? "Active" : "Inactive"}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Approve deposit */}
      <Dialog open={!!approveTarget} onOpenChange={o => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Deposit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Credited amount</Label><Input type="number" step="any" value={approveForm.credited} onChange={e => setApproveForm({ ...approveForm, credited: e.target.value })} /></div>
            <div><Label>TX hash</Label><Input value={approveForm.tx} onChange={e => setApproveForm({ ...approveForm, tx: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={approveForm.notes} onChange={e => setApproveForm({ ...approveForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button onClick={runApprove}>Confirm & Credit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark withdrawal sent */}
      <Dialog open={!!sendTarget} onOpenChange={o => !o && setSendTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Withdrawal Sent</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Blockchain TX hash (required)</Label><Input value={sendForm.tx} onChange={e => setSendForm({ ...sendForm, tx: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={sendForm.notes} onChange={e => setSendForm({ ...sendForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendTarget(null)}>Cancel</Button>
            <Button onClick={runSend}>Confirm Sent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <AlertDialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject request?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectTarget?.kind === "withdrawal" && "Locked funds will be returned to the user's available balance."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Reason (shown to user)" value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runReject}>Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add address */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Deposit Address</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Asset</Label><Input value={newAddr.crypto_type} onChange={e => setNewAddr({ ...newAddr, crypto_type: e.target.value })} /></div>
              <div><Label>Network</Label><Input value={newAddr.network} onChange={e => setNewAddr({ ...newAddr, network: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={newAddr.address} onChange={e => setNewAddr({ ...newAddr, address: e.target.value })} /></div>
            <div><Label>Memo (optional)</Label><Input value={newAddr.memo} onChange={e => setNewAddr({ ...newAddr, memo: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={newAddr.memo_required} onCheckedChange={c => setNewAddr({ ...newAddr, memo_required: c })} /><span className="text-sm">Memo required</span></div>
            <div><Label>Min deposit</Label><Input type="number" step="any" value={newAddr.min_deposit} onChange={e => setNewAddr({ ...newAddr, min_deposit: e.target.value })} /></div>
            <div><Label>Label</Label><Input value={newAddr.label} onChange={e => setNewAddr({ ...newAddr, label: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addAddress}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminManualTreasury;
