import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InlineLoader } from "@/components/loaders";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface IdempotencyRow {
  id: string;
  key: string;
  scope: string;
  reference_id: string | null;
  actor_id: string | null;
  status: "pending" | "completed" | "failed";
  response_snapshot: any;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string;
}

const SCOPES = [
  "all",
  "deposit",
  "escrow_lock",
  "release",
  "refund",
  "withdraw",
  "transfer",
];

const STATUSES = ["all", "pending", "completed", "failed"];

const statusVariant = (status: string) =>
  status === "completed"
    ? "default"
    : status === "failed"
    ? "destructive"
    : "secondary";

const AdminIdempotency = () => {
  const [rows, setRows] = useState<IdempotencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("idempotency_keys")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (scope !== "all") query = query.eq("scope", scope);
    if (status !== "all") query = query.eq("status", status);
    if (search.trim()) {
      const s = search.trim();
      query = query.or(`key.ilike.%${s}%,reference_id.ilike.%${s}%`);
    }
    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load idempotency keys");
      console.error(error);
    } else {
      setRows((data ?? []) as IdempotencyRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Idempotency Logs</h1>
          <p className="text-sm text-muted-foreground">
            Audit every financial action keyed by deposit, escrow, release,
            refund, withdrawal, and transfer.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow by scope, status, key, or reference.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All scopes" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All statuses" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search key, tx_hash, trade_id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetch()}
            />
            <Button onClick={fetch} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent keys</CardTitle>
          <CardDescription>Showing up to 200 most recent entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <InlineLoader />
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No idempotency keys match your filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <FragmentRow
                      key={r.id}
                      row={r}
                      expanded={expanded === r.id}
                      onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface FragmentRowProps {
  row: IdempotencyRow;
  expanded: boolean;
  onToggle: () => void;
}

const FragmentRow = ({ row: r, expanded, onToggle }: FragmentRowProps) => {
  return (
    <>
      <TableRow>
        <TableCell>
          <Badge variant="outline">{r.scope}</Badge>
        </TableCell>
        <TableCell>
          <Badge variant={statusVariant(r.status) as any}>{r.status}</Badge>
        </TableCell>
        <TableCell className="font-mono text-xs max-w-[200px] truncate">
          {r.reference_id ?? "—"}
        </TableCell>
        <TableCell className="font-mono text-xs max-w-[260px] truncate">
          {r.key}
        </TableCell>
        <TableCell className="text-xs whitespace-nowrap">
          {format(new Date(r.created_at), "MMM d, HH:mm:ss")}
        </TableCell>
        <TableCell>
          <Button size="sm" variant="ghost" onClick={onToggle}>
            {expanded ? "Hide" : "View"}
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/40">
            <div className="space-y-2 py-2">
              {r.error && (
                <div className="text-xs">
                  <span className="font-semibold text-destructive">Error: </span>
                  <span className="font-mono">{r.error}</span>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold mb-1">Response snapshot</p>
                <pre className="text-xs bg-background border border-border rounded-md p-3 overflow-x-auto">
                  {JSON.stringify(r.response_snapshot ?? {}, null, 2)}
                </pre>
              </div>
              <div className="text-xs text-muted-foreground">
                Expires {format(new Date(r.expires_at), "PPP p")}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default AdminIdempotency;

