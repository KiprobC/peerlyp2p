import {
  Users,
  ArrowRightLeft,
  AlertTriangle,
  DollarSign,
  Package,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Activity,
} from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { AdminAlerts } from "@/components/admin/AdminAlerts";
import { DataConsistencyCard } from "@/components/admin/DataConsistencyCard";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import { useAdminTrades, useAdminUsers, useAdminTransactions, usePlatformStats } from "@/hooks/useAdmin";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export const AdminOverview = () => {
  const { stats: realtimeStats, loading: realtimeLoading } = useAdminRealtime();
  const { stats, loading: statsLoading } = usePlatformStats();
  const { trades, disputedTrades } = useAdminTrades();
  const { users } = useAdminUsers();
  const { pendingTransactions } = useAdminTransactions();

  const recentTrades = trades.slice(0, 5);
  const pendingKYCUsers = users.filter((u) => u.kyc_status === "submitted");
  const pendingKYCDisplay = pendingKYCUsers.slice(0, 5);

  const isLoading = realtimeLoading && statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground">Real-time platform monitoring and statistics</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-green-500 animate-pulse" />
          <span>Live • Updates every 10s</span>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {(realtimeStats.pendingDisputes > 0 || realtimeStats.failedTransactions > 0) && (
        <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/5 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 text-sm">
            {realtimeStats.pendingDisputes > 0 && (
              <span className="font-medium text-destructive mr-4">
                {realtimeStats.pendingDisputes} active dispute{realtimeStats.pendingDisputes > 1 ? "s" : ""}
              </span>
            )}
            {realtimeStats.failedTransactions > 0 && (
              <span className="font-medium text-destructive">
                {realtimeStats.failedTransactions} failed transaction{realtimeStats.failedTransactions > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <Link to="/admin/disputes" className="text-xs text-primary hover:underline shrink-0">
            View →
          </Link>
        </div>
      )}

      {/* Main Stats Grid - Real-time */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={realtimeStats.totalUsers}
          icon={Users}
          subtitle={`${realtimeStats.pendingKYC} pending KYC`}
          variant="primary"
        />
        <StatsCard
          title="Active Trades"
          value={realtimeStats.activeTrades}
          icon={ArrowRightLeft}
          subtitle={`${stats.totalTrades} total`}
          variant="success"
        />
        <StatsCard
          title="Pending Disputes"
          value={realtimeStats.pendingDisputes}
          icon={AlertTriangle}
          subtitle="Requires attention"
          variant={realtimeStats.pendingDisputes > 0 ? "destructive" : "default"}
        />
        <StatsCard
          title="Escrow Locked"
          value={realtimeStats.escrowLocked.toFixed(4)}
          icon={Shield}
          subtitle="Total crypto in escrow"
          variant="warning"
        />
      </div>

      {/* Volume Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="24h Volume"
          value={`KES ${realtimeStats.tradingVolume24h.toLocaleString()}`}
          icon={DollarSign}
          variant="default"
        />
        <StatsCard
          title="Weekly Volume"
          value={`KES ${stats.weekVolume.toLocaleString()}`}
          icon={TrendingUp}
          variant="default"
        />
        <StatsCard
          title="Monthly Volume"
          value={`KES ${stats.monthVolume.toLocaleString()}`}
          icon={TrendingUp}
          trend={stats.monthVolume > 0 ? { value: "Active trading", isPositive: true } : undefined}
          variant="default"
        />
      </div>

      {/* Trade Status Distribution */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card text-center">
          <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-2xl font-bold">{stats.activeTrades}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="glass-card text-center">
          <CheckCircle className="h-6 w-6 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{stats.completedTrades}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </div>
        <div className="glass-card text-center">
          <XCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
          <p className="text-2xl font-bold">{stats.cancelledTrades}</p>
          <p className="text-xs text-muted-foreground">Cancelled</p>
        </div>
        <div className="glass-card text-center">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
          <p className="text-2xl font-bold">{stats.disputedTrades}</p>
          <p className="text-xs text-muted-foreground">Disputed</p>
        </div>
        <div className="glass-card text-center">
          <Package className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-2xl font-bold">{stats.activeOffers}</p>
          <p className="text-xs text-muted-foreground">Active Offers</p>
        </div>
      </div>

      {/* Alerts Section */}
      <AdminAlerts
        pendingKYC={pendingKYCUsers.length}
        disputedTrades={disputedTrades.length}
        totalEscrowLocked={realtimeStats.escrowLocked}
        failedTransactions={pendingTransactions.filter(t => t.status === "failed").length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trades */}
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Trades</h2>
            <Link to="/admin/trades" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentTrades.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No trades yet</p>
            ) : (
              recentTrades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div>
                    <p className="font-medium">
                      {trade.crypto_amount} {trade.crypto_type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {trade.fiat_currency} {trade.fiat_amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        trade.status === "completed"
                          ? "default"
                          : trade.status === "disputed"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {trade.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending KYC Approvals */}
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-yellow-500" />
              Pending KYC ({pendingKYCUsers.length})
            </h2>
            <Link to="/admin/kyc" className="text-sm text-primary hover:underline">
              Review all
            </Link>
          </div>
          <div className="space-y-3">
            {pendingKYCDisplay.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No pending approvals</p>
            ) : (
              pendingKYCDisplay.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div>
                    <p className="font-medium">{user.full_name || "No name"}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                      Submitted
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Data Consistency Check */}
      <DataConsistencyCard />

      {/* Active Disputes Alert */}
      {disputedTrades.length > 0 && (
        <div className="glass-card border-destructive/30 bg-destructive/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Active Disputes ({disputedTrades.length})
            </h2>
            <Link to="/admin/disputes" className="text-sm text-primary hover:underline">
              Resolve now
            </Link>
          </div>
          <div className="space-y-3">
            {disputedTrades.slice(0, 3).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
              >
                <div>
                  <p className="font-medium">
                    Trade #{trade.id.slice(0, 8)} - {trade.crypto_amount} {trade.crypto_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {trade.dispute_reason || "No reason provided"}
                  </p>
                </div>
                <Link
                  to="/admin/disputes"
                  className="text-sm text-primary hover:underline"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
