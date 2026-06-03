import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRiskEvents, useAccountFreezes, useFreezeUser, useUnfreezeUser } from "@/hooks/useRiskCenter";
import { formatDistanceToNow } from "date-fns";
import { ShieldAlert, Snowflake } from "lucide-react";

const levelColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "secondary",
  medium: "outline",
  high: "default",
  critical: "destructive",
};

export default function AdminRiskCenter() {
  const [levelFilter, setLevelFilter] = useState<string>("");
  const { data: events = [], isLoading } = useRiskEvents(levelFilter || undefined, 200);
  const { data: freezes = [] } = useAccountFreezes();
  const freeze = useFreezeUser();
  const unfreeze = useUnfreezeUser();

  const [userId, setUserId] = useState("");
  const [scope, setScope] = useState<"withdrawals" | "trading" | "account">("withdrawals");
  const [reason, setReason] = useState("");

  const criticalCount = events.filter((e) => e.risk_level === "critical").length;
  const highCount = events.filter((e) => e.risk_level === "high").length;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Risk Center</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Critical events</div><div className="text-2xl font-bold text-destructive">{criticalCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">High events</div><div className="text-2xl font-bold">{highCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active freezes</div><div className="text-2xl font-bold">{freezes.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Recent events</div><div className="text-2xl font-bold">{events.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Risk Events</TabsTrigger>
          <TabsTrigger value="freezes">Active Freezes</TabsTrigger>
          <TabsTrigger value="freeze">Freeze User</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent risk evaluations</CardTitle>
              <Select value={levelFilter || "all"} onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All levels" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && events.length === 0 && <p className="text-sm text-muted-foreground">No events.</p>}
              {events.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={levelColor[e.risk_level]}>{e.risk_level}</Badge>
                      <span className="text-sm font-medium">{e.action_type}</span>
                      <span className="text-xs text-muted-foreground">score {Number(e.risk_score).toFixed(0)}</span>
                      <span className="text-xs text-muted-foreground">{e.decision}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">user {e.user_id}</div>
                    <div className="text-xs text-muted-foreground">{Array.isArray(e.reasons) ? e.reasons.join(", ") : ""}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="freezes">
          <Card>
            <CardHeader><CardTitle>Active freezes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {freezes.length === 0 && <p className="text-sm text-muted-foreground">No active freezes.</p>}
              {freezes.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4 text-primary" />
                      <Badge>{f.scope}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(f.frozen_at), { addSuffix: true })}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">user {f.user_id}</div>
                    {f.reason && <div className="text-xs">{f.reason}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => unfreeze.mutate({ userId: f.user_id, scope: f.scope })}>
                    Unfreeze
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="freeze">
          <Card>
            <CardHeader><CardTitle>Freeze a user</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-md">
              <Input placeholder="User ID (uuid)" value={userId} onChange={(e) => setUserId(e.target.value)} />
              <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="withdrawals">Withdrawals</SelectItem>
                  <SelectItem value="trading">Trading</SelectItem>
                  <SelectItem value="account">Entire account</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button
                disabled={!userId || freeze.isPending}
                onClick={() => freeze.mutate({ userId, scope, reason }, { onSuccess: () => { setUserId(""); setReason(""); } })}
              >
                Freeze
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
