import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw, Sliders } from "lucide-react";

interface Override {
  crypto_type: string;
  network: string;
  daily_limit: number;
  enabled: boolean;
  notes: string | null;
  updated_at: string;
}

const emptyForm = { crypto_type: "USDT", network: "tron", daily_limit: "1000", enabled: true, notes: "" };

const AdminWithdrawalLimits = () => {
  const [rows, setRows] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Override | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Override | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("withdrawal_limit_overrides").select("*").order("crypto_type");
    setRows((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (r: Override) => {
    setEditing(r);
    setForm({ crypto_type: r.crypto_type, network: r.network, daily_limit: String(r.daily_limit), enabled: r.enabled, notes: r.notes || "" });
    setOpen(true);
  };

  const save = async () => {
    const limit = parseFloat(form.daily_limit);
    if (isNaN(limit) || limit < 0) return toast.error("Enter a valid daily limit");
    const { error } = await supabase.rpc("admin_upsert_withdrawal_limit", {
      p_crypto_type: form.crypto_type,
      p_network: form.network,
      p_daily_limit: limit,
      p_enabled: form.enabled,
      p_notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Override saved");
    setOpen(false);
    load();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.rpc("admin_delete_withdrawal_limit", {
      p_crypto_type: deleteTarget.crypto_type,
      p_network: deleteTarget.network,
    });
    if (error) return toast.error(error.message);
    toast.success("Override removed");
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sliders className="w-6 h-6" /> Withdrawal Limit Overrides</h1>
          <p className="text-sm text-muted-foreground">Per asset/network daily caps. All changes are audited.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add Override</Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">No overrides configured. Default KYC tier limits apply.</p>}
      {rows.map(r => (
        <Card key={`${r.crypto_type}-${r.network}`}>
          <CardContent className="pt-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">
                {r.crypto_type} <span className="text-muted-foreground text-xs">/ {r.network}</span>{" "}
                <Badge variant={r.enabled ? "default" : "secondary"} className="ml-2">{r.enabled ? "Enabled" : "Disabled"}</Badge>
              </p>
              <p className="text-sm">Daily limit: <span className="font-mono">{r.daily_limit}</span></p>
              {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
              <p className="text-xs text-muted-foreground">Updated {new Date(r.updated_at).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(r)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Override" : "Add Override"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Asset</Label><Input value={form.crypto_type} disabled={!!editing} onChange={e => setForm({ ...form, crypto_type: e.target.value.toUpperCase() })} /></div>
              <div><Label>Network</Label><Input value={form.network} disabled={!!editing} onChange={e => setForm({ ...form, network: e.target.value.toLowerCase() })} /></div>
            </div>
            <div><Label>Daily limit</Label><Input type="number" step="any" value={form.daily_limit} onChange={e => setForm({ ...form, daily_limit: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.enabled} onCheckedChange={c => setForm({ ...form, enabled: c })} /><span className="text-sm">Enabled</span></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove override?</AlertDialogTitle>
            <AlertDialogDescription>Default KYC tier limits will resume for {deleteTarget?.crypto_type}/{deleteTarget?.network}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminWithdrawalLimits;
