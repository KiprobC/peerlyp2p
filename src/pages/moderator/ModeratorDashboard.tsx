import { useModeratorDisputes } from "@/hooks/useModeratorRole";
import { useModeratorAvailability } from "@/hooks/useModeratorAvailability";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Scale, Timer, TrendingUp, Users, Circle } from "lucide-react";
import { Link } from "react-router-dom";
import { ModeratorStatusToggle } from "@/components/moderator/ModeratorStatusToggle";
import { SLATimer } from "@/components/moderator/SLATimer";
import { formatDistanceToNow } from "date-fns";

export const ModeratorDashboard = () => {
  const { pendingDisputes, resolvedDisputes, disputes, loading } = useModeratorDisputes();
  const { availability, allModerators, setStatus } = useModeratorAvailability();

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Moderator Dashboard</h1>
          <p className="text-muted-foreground">Manage disputes and track SLA performance</p>
        </div>
        {availability && (
          <ModeratorStatusToggle
            status={availability.status as any}
            onStatusChange={setStatus}
          />
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingDisputes.length}</p>
                <p className="text-xs text-muted-foreground">Active Disputes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-primary/10">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingSLACount}</p>
                <p className="text-xs text-muted-foreground">Pending SLA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={slaBreachedCount > 0 ? "bg-destructive/5 border-destructive/20" : "bg-green-500/5 border-green-500/20"}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-full ${slaBreachedCount > 0 ? "bg-destructive/10" : "bg-green-500/10"}`}>
                <Scale className={`h-5 w-5 ${slaBreachedCount > 0 ? "text-destructive" : "text-green-500"}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{slaBreachedCount}</p>
                <p className="text-xs text-muted-foreground">SLA Breached</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgResolutionHours}h</p>
                <p className="text-xs text-muted-foreground">Avg Resolution</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Online Moderators */}
      {allModerators.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Moderator Team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {allModerators.map((mod) => (
                <div key={mod.user_id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border text-xs">
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

      {/* Active Disputes Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Active Disputes
          </CardTitle>
          <Link to="/moderator/disputes">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pendingDisputes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500/50" />
              <p>No pending disputes assigned to you</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingDisputes.slice(0, 8).map((dispute) => {
                const da = dispute as any;
                return (
                  <div
                    key={dispute.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs">#{dispute.trade_id.slice(0, 8)}</span>
                        <Badge
                          variant={dispute.priority === "critical" || dispute.priority === "high" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {dispute.priority}
                        </Badge>
                        {da.escalated && (
                          <Badge variant="destructive" className="text-[10px]">Escalated</Badge>
                        )}
                      </div>
                      {dispute.trade && (
                        <p className="text-xs text-muted-foreground">
                          {dispute.trade.crypto_amount} {dispute.trade.crypto_type} • {dispute.trade.fiat_currency} {dispute.trade.fiat_amount?.toLocaleString()}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>@{dispute.buyer?.username || "?"} vs @{dispute.seller?.username || "?"}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <SLATimer
                        slaDeadline={da.sla_deadline}
                        firstResponseAt={da.first_response_at}
                        slaBreached={da.sla_breached}
                        escalated={da.escalated}
                        compact
                      />
                      <Link to={`/moderator/disputes?trade=${dispute.trade_id}`}>
                        <Button size="sm" className="h-7 text-xs">Review</Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
