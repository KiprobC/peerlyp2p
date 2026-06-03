import { useReconciliation } from "@/hooks/useReconciliation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, PlayCircle, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export const ReconciliationPanel = () => {
  const { runs, results, loading, running, runNow, refetch } = useReconciliation();
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const activeRunId = selectedRun ?? runs[0]?.id ?? null;
  const runResults = results.filter((r) => r.run_id === activeRunId);

  const exportCSV = () => {
    if (!runResults.length) return;
    const headers = [
      "crypto", "user_balance", "user_locked", "reserved_offers", "platform_balance",
      "deposits", "withdrawals", "fees_collected", "expected", "actual", "drift", "status",
    ];
    const rows = runResults.map((r) => [
      r.crypto_type, r.user_wallet_balance, r.user_locked_balance, r.reserved_in_offers,
      r.platform_wallet_balance, r.total_deposits, r.total_withdrawals, r.total_fees_collected,
      r.expected_total, r.actual_total, r.drift, r.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reconciliation_${activeRunId}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ledger Reconciliation</CardTitle>
            <CardDescription>
              Verifies Σ(user balances + locked + platform) = Σ(deposits) − Σ(withdrawals). Runs nightly at 02:00 UTC.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={runNow} disabled={running}>
              <PlayCircle className="h-4 w-4 mr-2" /> {running ? "Running…" : "Run Now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No reconciliation runs yet. Click "Run Now" to start one.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {runs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRun(r.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition ${
                    activeRunId === r.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {r.status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : r.status === "drift" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {format(new Date(r.started_at), "MMM d, yyyy HH:mm:ss")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.triggered_by} · {r.finished_at ? `${Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()))}ms` : "in progress"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={r.status === "ok" ? "default" : r.status === "drift" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                    <span className="font-mono text-sm">drift: {Number(r.total_drift).toFixed(8)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeRunId && runResults.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Run Details</CardTitle>
              <CardDescription>Per-crypto breakdown</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Crypto</th>
                    <th className="text-right p-2">User Bal</th>
                    <th className="text-right p-2">Locked</th>
                    <th className="text-right p-2">Platform</th>
                    <th className="text-right p-2">Deposits</th>
                    <th className="text-right p-2">Withdrawals</th>
                    <th className="text-right p-2">Expected</th>
                    <th className="text-right p-2">Actual</th>
                    <th className="text-right p-2">Drift</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {runResults.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-2 font-medium">{r.crypto_type}</td>
                      <td className="p-2 text-right font-mono">{Number(r.user_wallet_balance).toFixed(8)}</td>
                      <td className="p-2 text-right font-mono">{Number(r.user_locked_balance).toFixed(8)}</td>
                      <td className="p-2 text-right font-mono">{Number(r.platform_wallet_balance).toFixed(8)}</td>
                      <td className="p-2 text-right font-mono">{Number(r.total_deposits).toFixed(8)}</td>
                      <td className="p-2 text-right font-mono">{Number(r.total_withdrawals).toFixed(8)}</td>
                      <td className="p-2 text-right font-mono">{Number(r.expected_total).toFixed(8)}</td>
                      <td className="p-2 text-right font-mono">{Number(r.actual_total).toFixed(8)}</td>
                      <td className={`p-2 text-right font-mono ${Math.abs(Number(r.drift)) > 0 ? "text-destructive font-semibold" : ""}`}>
                        {Number(r.drift).toFixed(8)}
                      </td>
                      <td className="p-2">
                        <Badge variant={r.status === "ok" ? "default" : "destructive"}>{r.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
