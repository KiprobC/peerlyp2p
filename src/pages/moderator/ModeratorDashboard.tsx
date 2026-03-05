import { useState, useEffect } from "react";
import { useModeratorDisputes } from "@/hooks/useModeratorRole";
import { useModeratorAvailability } from "@/hooks/useModeratorAvailability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Scale, Timer, TrendingUp, Users, Circle, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { ModeratorStatusToggle } from "@/components/moderator/ModeratorStatusToggle";
import { SLATimer } from "@/components/moderator/SLATimer";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const ModeratorDashboard = () => {
  const { pendingDisputes, resolvedDisputes, disputes, loading } = useModeratorDisputes();
  const { availability, allModerators, setStatus } = useModeratorAvailability();

  // Fetch suspicious traders
  const [suspiciousTraders, setSuspiciousTraders] = useState<any[]>([]);
  useEffect(() => {
    const fetchSuspicious = async () => {
      const { data: alerts } = await supabase
        .from("user_risk_alerts" as any)
        .select("*")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (!alerts || alerts.length === 0) { setSuspiciousTraders([]); return; }

      const userIds = [...new Set((alerts as any[]).map((a: any) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, full_name")
        .in("user_id", userIds);

      const { data: metrics } = await supabase
        .from("trader_behavior_metrics" as any)
        .select("user_id, risk_level, risk_score")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const metricsMap = new Map((metrics || []).map((m: any) => [m.user_id, m]));

      const grouped = userIds.map(uid => ({
        user_id: uid,
        username: (profileMap.get(uid) as any)?.username || "Unknown",
        risk_level: (metricsMap.get(uid) as any)?.risk_level || "normal",
        risk_score: (metricsMap.get(uid) as any)?.risk_score || 0,
        alerts: (alerts as any[]).filter((a: any) => a.user_id === uid),
      }));

      setSuspiciousTraders(grouped.sort((a, b) => b.risk_score - a.risk_score));
    };
    fetchSuspicious();
  }, []);

  const slaBreachedCount = pendingDisputes.filter(
    (d) => (d as any).sla_breached || (d as any).escalated
  ).length;

  const pendingSLACount = pendingDisputes.filter(
    (d) => (d as any).sla_deadline && !(d as any).first_response_at && !(d as any).sla_breached
  ).length;

  const avgResolutionMs = resolvedDisputes.length > 0
    ? resolvedDisputes.reduce((sum, d) => {
        const created = new Date(d.created_at).getTime();
        const resolved = d.resolved_at ? new Date(d.resolved_at).getTime() : created;
        return sum + (resolved - created);
      }, 0) / resolvedDisputes.length
    : 0;

  const avgResolutionHours = Math.round(avgResolutionMs / (1000 * 60 * 60) * 10) / 10;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Moderator</h1>
          <p className="text-xs text-muted-foreground">Disputes & SLA tracking</p>
        </div>
        {availability && (
          <ModeratorStatusToggle
            status={availability.status as any}
            onStatusChange={setStatus}
          />
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{pendingDisputes.length}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-full bg-primary/10">
                <Timer className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{pendingSLACount}</p>
                <p className="text-[10px] text-muted-foreground">Pending SLA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-full ${slaBreachedCount > 0 ? "bg-destructive/10" : "bg-green-500/10"}`}>
                <Scale className={`h-4 w-4 ${slaBreachedCount > 0 ? "text-destructive" : "text-green-500"}`} />
              </div>
              <div>
                <p className="text-xl font-bold">{slaBreachedCount}</p>
                <p className="text-[10px] text-muted-foreground">Breached</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-full bg-green-500/10">
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{avgResolutionHours}h</p>
                <p className="text-[10px] text-muted-foreground">Avg Resolve</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Online Moderators */}
      {allModerators.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allModerators.map((mod) => (
                <div key={mod.user_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 text-[11px]">
                  <Circle className={`w-2 h-2 fill-current ${
                    mod.status === "online" ? "text-green-500" : mod.status === "busy" ? "text-amber-500" : "text-muted-foreground"
                  }`} />
                  <span className="font-medium">@{mod.username || "unknown"}</span>
                  <span className="text-muted-foreground">{mod.active_cases_count}/{mod.max_cases}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Disputes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-amber-500" />
            Active Disputes
          </CardTitle>
          <Link to="/moderator/disputes">
            <Button variant="ghost" size="sm" className="text-xs text-primary">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pendingDisputes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500/30" />
              <p className="text-sm">No pending disputes</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pendingDisputes.slice(0, 8).map((dispute) => {
                const da = dispute as any;
                return (
                  <div
                    key={dispute.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px]">#{dispute.trade_id.slice(0, 8)}</span>
                        <Badge
                          variant={dispute.priority === "critical" || dispute.priority === "high" ? "destructive" : "secondary"}
                          className="text-[9px] rounded-full px-1.5"
                        >
                          {dispute.priority}
                        </Badge>
                        {da.escalated && (
                          <Badge variant="destructive" className="text-[9px] rounded-full px-1.5">Escalated</Badge>
                        )}
                      </div>
                      {dispute.trade && (
                        <p className="text-[10px] text-muted-foreground">
                          {dispute.trade.crypto_amount} {dispute.trade.crypto_type} • {dispute.trade.fiat_currency} {dispute.trade.fiat_amount?.toLocaleString()}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>@{dispute.buyer?.username || "?"} vs @{dispute.seller?.username || "?"}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <SLATimer
                        slaDeadline={da.sla_deadline}
                        firstResponseAt={da.first_response_at}
                        slaBreached={da.sla_breached}
                        escalated={da.escalated}
                        compact
                      />
                      <Link to={`/moderator/disputes?trade=${dispute.trade_id}`}>
                        <Button size="sm" className="h-7 text-[11px] rounded-full px-3">Review</Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suspicious Traders */}
      {suspiciousTraders.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Suspicious Traders
            </CardTitle>
            <Badge variant="destructive" className="text-[10px]">{suspiciousTraders.length}</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suspiciousTraders.slice(0, 10).map((trader) => {
                const riskColors: Record<string, string> = {
                  trusted: "text-green-500",
                  normal: "text-yellow-500",
                  watchlist: "text-orange-500",
                  high_risk: "text-destructive",
                };
                return (
                  <div key={trader.user_id} className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/30">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">@{trader.username}</span>
                        <Badge variant="outline" className={`text-[9px] ${riskColors[trader.risk_level] || ""}`}>
                          {trader.risk_level?.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {trader.alerts[0]?.description || "Flagged for review"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {trader.alerts.length} active alert{trader.alerts.length !== 1 ? "s" : ""} · Score: {Math.round(trader.risk_score)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
