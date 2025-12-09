import { Users, ArrowRightLeft, AlertTriangle, TrendingUp, DollarSign, Package } from "lucide-react";
import { StatsCard } from "@/components/admin/StatsCard";
import { usePlatformStats, useAdminTrades } from "@/hooks/useAdmin";
import { formatDistanceToNow } from "date-fns";

export const AdminOverview = () => {
  const { stats, loading: statsLoading } = usePlatformStats();
  const { disputedTrades, loading: tradesLoading } = useAdminTrades();

  if (statsLoading || tradesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <p className="text-muted-foreground">Monitor platform activity and performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          trend={`${stats.verifiedUsers} verified`}
          trendUp
        />
        <StatsCard
          title="Total Trades"
          value={stats.totalTrades}
          icon={ArrowRightLeft}
          trend={`${stats.completedTrades} completed`}
          trendUp
        />
        <StatsCard
          title="Active Disputes"
          value={stats.disputedTrades}
          icon={AlertTriangle}
          className={stats.disputedTrades > 0 ? "border-destructive/30" : ""}
        />
        <StatsCard
          title="Trade Volume"
          value={`KES ${stats.totalVolume.toLocaleString()}`}
          icon={DollarSign}
          trendUp
        />
        <StatsCard
          title="Active Offers"
          value={stats.activeOffers}
          icon={Package}
        />
        <StatsCard
          title="Success Rate"
          value={stats.totalTrades > 0 
            ? `${((stats.completedTrades / stats.totalTrades) * 100).toFixed(1)}%` 
            : "N/A"}
          icon={TrendingUp}
          trendUp
        />
      </div>

      {disputedTrades.length > 0 && (
        <div className="glass-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Recent Disputes
          </h2>
          <div className="space-y-3">
            {disputedTrades.slice(0, 5).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-destructive/20"
              >
                <div>
                  <p className="font-medium">
                    {trade.crypto_amount} {trade.crypto_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {trade.dispute_reason || "No reason provided"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(trade.disputed_at || trade.created_at), { addSuffix: true })}
                  </p>
                  <a
                    href={`/admin/disputes`}
                    className="text-sm text-primary hover:underline"
                  >
                    View Details
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
