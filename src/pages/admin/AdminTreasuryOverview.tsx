import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Landmark, Clock, ArrowDownCircle, ArrowUpCircle, ShieldCheck, Wallet } from "lucide-react";

interface Overview {
  user_liabilities: Record<string, number> | null;
  pending_deposits: Record<string, number> | null;
  pending_withdrawals: Record<string, number> | null;
  platform_balances: Record<string, number> | null;
  last_reconciliation: { started_at: string; status: string; total_checked: number; mismatches_found: number } | null;
  counts: {
    pending_deposit_requests: number;
    pending_withdrawal_requests: number;
    active_deposit_addresses: number;
    inactive_deposit_addresses: number;
  };
}

const Bucket = ({ title, icon: Icon, data }: { title: string; icon: any; data: Record<string, number> | null | undefined }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2"><Icon className="w-4 h-4" /> {title}</CardTitle>
    </CardHeader>
    <CardContent>
      {!data || Object.keys(data).length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {Object.entries(data).map(([k, v]) => (
            <li key={k} className="flex justify-between font-mono">
              <span>{k}</span>
              <span>{Number(v).toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

const AdminTreasuryOverview = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: res, error } = await supabase.rpc("admin_treasury_overview");
    if (!error) setData(res as unknown as Overview);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const recon = data?.last_reconciliation;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Landmark className="w-6 h-6" /> Treasury Overview</h1>
          <p className="text-sm text-muted-foreground">Live snapshot of liabilities, in-flight movements, and reconciliation.</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pending deposits</p><p className="text-2xl font-bold">{data.counts.pending_deposit_requests}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pending withdrawals</p><p className="text-2xl font-bold">{data.counts.pending_withdrawal_requests}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Active addresses</p><p className="text-2xl font-bold">{data.counts.active_deposit_addresses}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Inactive addresses</p><p className="text-2xl font-bold">{data.counts.inactive_deposit_addresses}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Bucket title="User liabilities (total user balances)" icon={Wallet} data={data.user_liabilities} />
            <Bucket title="Platform treasury balances" icon={Landmark} data={data.platform_balances} />
            <Bucket title="Pending inbound deposits" icon={ArrowDownCircle} data={data.pending_deposits} />
            <Bucket title="Pending outbound withdrawals" icon={ArrowUpCircle} data={data.pending_withdrawals} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Last reconciliation</CardTitle>
              <CardDescription className="text-xs">Nightly automated ledger integrity check</CardDescription>
            </CardHeader>
            <CardContent>
              {!recon ? (
                <p className="text-sm text-muted-foreground">No reconciliation runs yet.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge variant={recon.status === "ok" || recon.mismatches_found === 0 ? "default" : "destructive"}>
                    {recon.status}
                  </Badge>
                  <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3" />{new Date(recon.started_at).toLocaleString()}</span>
                  <span>Checked: <span className="font-mono">{recon.total_checked}</span></span>
                  <span>Mismatches: <span className="font-mono">{recon.mismatches_found}</span></span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminTreasuryOverview;
