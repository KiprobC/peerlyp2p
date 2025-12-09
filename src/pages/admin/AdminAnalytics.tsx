import { useMemo } from "react";
import { TrendingUp, Users, ArrowRightLeft, DollarSign, Package } from "lucide-react";
import { usePlatformStats, useAdminTrades, useAdminUsers } from "@/hooks/useAdmin";
import { StatsCard } from "@/components/admin/StatsCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, parseISO, startOfDay } from "date-fns";

const COLORS = ["hsl(152, 76%, 45%)", "hsl(45, 93%, 58%)", "hsl(0, 72%, 51%)", "hsl(220, 15%, 55%)"];

export const AdminAnalytics = () => {
  const { stats, loading: statsLoading } = usePlatformStats();
  const { trades, loading: tradesLoading } = useAdminTrades();
  const { users, loading: usersLoading } = useAdminUsers();

  const tradesByDay = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return {
        date: format(date, "MMM dd"),
        fullDate: startOfDay(date).toISOString(),
        trades: 0,
        volume: 0,
      };
    });

    trades.forEach((trade) => {
      const tradeDate = startOfDay(parseISO(trade.created_at)).toISOString();
      const dayData = last7Days.find((d) => d.fullDate === tradeDate);
      if (dayData) {
        dayData.trades += 1;
        dayData.volume += trade.fiat_amount;
      }
    });

    return last7Days;
  }, [trades]);

  const tradeStatusData = useMemo(() => {
    const statusCounts = trades.reduce((acc, trade) => {
      const status = trade.status || "pending";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [trades]);

  const kycStatusData = useMemo(() => {
    const statusCounts = users.reduce((acc, user) => {
      acc[user.kyc_status] = (acc[user.kyc_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [users]);

  const loading = statsLoading || tradesLoading || usersLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Platform Analytics</h1>
        <p className="text-muted-foreground">Detailed platform statistics and trends</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          subtitle={`${stats.verifiedUsers} verified`}
        />
        <StatsCard
          title="Total Trades"
          value={stats.totalTrades}
          icon={ArrowRightLeft}
        />
        <StatsCard
          title="Total Volume"
          value={`KES ${(stats.totalVolume / 1000000).toFixed(2)}M`}
          icon={DollarSign}
        />
        <StatsCard
          title="Active Offers"
          value={stats.activeOffers}
          icon={Package}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trade Activity (Last 7 Days)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={tradesByDay}>
              <defs>
                <linearGradient id="colorTrades" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 76%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152, 76%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" stroke="hsl(220, 10%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 55%)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 8%)",
                  border: "1px solid hsl(220, 15%, 18%)",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(0, 0%, 98%)" }}
              />
              <Area
                type="monotone"
                dataKey="trades"
                stroke="hsl(152, 76%, 45%)"
                fillOpacity={1}
                fill="url(#colorTrades)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card">
          <h3 className="text-lg font-semibold mb-4">Trade Volume (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tradesByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" stroke="hsl(220, 10%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 55%)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 8%)",
                  border: "1px solid hsl(220, 15%, 18%)",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => [`KES ${value.toLocaleString()}`, "Volume"]}
              />
              <Bar dataKey="volume" fill="hsl(45, 93%, 58%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card">
          <h3 className="text-lg font-semibold mb-4">Trade Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={tradeStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {tradeStatusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 8%)",
                  border: "1px solid hsl(220, 15%, 18%)",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card">
          <h3 className="text-lg font-semibold mb-4">User KYC Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={kycStatusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {kycStatusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 18%, 8%)",
                  border: "1px solid hsl(220, 15%, 18%)",
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card">
        <h3 className="text-lg font-semibold mb-4">Key Metrics Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">
              {stats.totalTrades > 0 ? ((stats.completedTrades / stats.totalTrades) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Trade Success Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-accent">
              {stats.totalUsers > 0 ? ((stats.verifiedUsers / stats.totalUsers) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-sm text-muted-foreground">User Verification Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">
              {stats.totalTrades > 0 ? Math.round(stats.totalVolume / stats.totalTrades).toLocaleString() : 0}
            </p>
            <p className="text-sm text-muted-foreground">Avg Trade Value (KES)</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-destructive">
              {stats.disputedTrades}
            </p>
            <p className="text-sm text-muted-foreground">Active Disputes</p>
          </div>
        </div>
      </div>
    </div>
  );
};
