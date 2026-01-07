import { useModeratorDisputes } from "@/hooks/useModeratorRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Scale } from "lucide-react";
import { Link } from "react-router-dom";

export const ModeratorDashboard = () => {
  const { pendingDisputes, resolvedDisputes, loading } = useModeratorDisputes();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Moderator Dashboard</h1>
        <p className="text-muted-foreground">Manage assigned disputes and resolutions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{pendingDisputes.length}</p>
                <p className="text-sm text-muted-foreground">Pending Disputes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">{resolvedDisputes.length}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Scale className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {resolvedDisputes.length > 0
                    ? Math.round(
                        (resolvedDisputes.length /
                          (pendingDisputes.length + resolvedDisputes.length)) *
                          100
                      )
                    : 0}
                  %
                </p>
                <p className="text-sm text-muted-foreground">Resolution Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Disputes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Pending Disputes
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
            <div className="space-y-3">
              {pendingDisputes.slice(0, 5).map((dispute) => (
                <div
                  key={dispute.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        Trade #{dispute.trade_id.slice(0, 8)}
                      </span>
                      <Badge
                        variant={
                          dispute.priority === "critical" || dispute.priority === "high"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {dispute.priority}
                      </Badge>
                    </div>
                    {dispute.trade && (
                      <p className="text-sm text-muted-foreground">
                        {dispute.trade.crypto_amount} {dispute.trade.crypto_type} •{" "}
                        {dispute.trade.fiat_currency} {dispute.trade.fiat_amount.toLocaleString()}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Buyer: @{dispute.buyer?.username || "unknown"}</span>
                      <span>•</span>
                      <span>Seller: @{dispute.seller?.username || "unknown"}</span>
                    </div>
                  </div>
                  <Link to={`/moderator/disputes?trade=${dispute.trade_id}`}>
                    <Button size="sm">Review</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
