import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  DollarSign,
  Clock,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Percent,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useOfferAnalytics, OfferAnalytics } from "@/hooks/useOfferAnalytics";
import { cryptoInfo } from "@/hooks/useWallets";
import { formatDistanceToNow } from "date-fns";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(45, 93%, 47%)",
  destructive: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
};

const PIE_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6"];

const OfferAnalyticsPage = () => {
  const { offerAnalytics, dailyTradeData, summary, loading } = useOfferAnalytics();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center h-16">
              <Skeleton className="h-8 w-48" />
            </div>
          </div>
        </nav>
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-7xl space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-80" />
            <Skeleton className="h-96" />
          </div>
        </main>
      </div>
    );
  }

  const tradeStatusData = [
    { name: "Completed", value: summary.completedTrades, color: PIE_COLORS[0] },
    { name: "Cancelled", value: offerAnalytics.reduce((sum, o) => sum + o.cancelledTrades, 0), color: PIE_COLORS[1] },
    { name: "Disputed", value: offerAnalytics.reduce((sum, o) => sum + o.disputedTrades, 0), color: PIE_COLORS[2] },
    { name: "Pending", value: offerAnalytics.reduce((sum, o) => sum + o.pendingTrades, 0), color: PIE_COLORS[3] },
  ].filter((d) => d.value > 0);

  const offerTypeData = [
    { name: "Buy Offers", value: offerAnalytics.filter((o) => o.offerType === "buy").length },
    { name: "Sell Offers", value: offerAnalytics.filter((o) => o.offerType === "sell").length },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/my-offers">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">Offer Analytics</h1>
                <p className="text-xs text-muted-foreground">Performance insights</p>
              </div>
            </div>
            <Link to="/create-offer">
              <Button size="sm">Create Offer</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-4 max-w-7xl space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold truncate">{summary.totalOffers}</p>
                    <p className="text-xs text-muted-foreground truncate">Total Offers</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  {summary.activeOffers} active
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10 shrink-0">
                    <Activity className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold truncate">{summary.totalTrades}</p>
                    <p className="text-xs text-muted-foreground truncate">Total Trades</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  {summary.completedTrades} completed
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                    <Percent className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold truncate">
                      {summary.overallConversionRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground truncate">Conversion Rate</p>
                  </div>
                </div>
                <Progress 
                  value={summary.overallConversionRate} 
                  className="mt-2 h-1.5" 
                />
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
                    <DollarSign className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold truncate">
                      {summary.totalVolumeFiat >= 1000000
                        ? `${(summary.totalVolumeFiat / 1000000).toFixed(1)}M`
                        : summary.totalVolumeFiat >= 1000
                        ? `${(summary.totalVolumeFiat / 1000).toFixed(1)}K`
                        : summary.totalVolumeFiat.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">Total Volume (KES)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Trade Activity Chart */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Trade Activity (30 Days)
                </CardTitle>
                <CardDescription>Daily trades and completed transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTradeData}>
                      <defs>
                        <linearGradient id="colorTrades" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }} 
                        className="text-muted-foreground"
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="trades"
                        stroke={CHART_COLORS.primary}
                        fillOpacity={1}
                        fill="url(#colorTrades)"
                        name="Total Trades"
                      />
                      <Area
                        type="monotone"
                        dataKey="completed"
                        stroke={CHART_COLORS.success}
                        fillOpacity={1}
                        fill="url(#colorCompleted)"
                        name="Completed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Trade Status Distribution */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Trade Status Distribution
                </CardTitle>
                <CardDescription>Breakdown by outcome</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {tradeStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tradeStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {tradeStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--background))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No trade data yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Volume Chart */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Trade Volume (30 Days)
              </CardTitle>
              <CardDescription>Daily trading volume in KES</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTradeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      className="text-muted-foreground"
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      className="text-muted-foreground"
                      tickFormatter={(value) => 
                        value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value
                      }
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`KES ${value.toLocaleString()}`, "Volume"]}
                    />
                    <Bar 
                      dataKey="volume" 
                      fill={CHART_COLORS.primary} 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Best & Worst Performers */}
          {(summary.bestPerformingOffer || summary.worstPerformingOffer) && (
            <div className="grid md:grid-cols-2 gap-6">
              {summary.bestPerformingOffer && (
                <Card className="glass-card border-green-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-green-500">
                      <Zap className="w-4 h-4" />
                      Best Performing Offer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OfferPerformanceCard offer={summary.bestPerformingOffer} />
                  </CardContent>
                </Card>
              )}
              {summary.worstPerformingOffer && 
               summary.worstPerformingOffer.offerId !== summary.bestPerformingOffer?.offerId && (
                <Card className="glass-card border-yellow-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-yellow-500">
                      <AlertTriangle className="w-4 h-4" />
                      Needs Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OfferPerformanceCard offer={summary.worstPerformingOffer} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Offers Table */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">All Offers Performance</CardTitle>
              <CardDescription>Detailed metrics for each offer</CardDescription>
            </CardHeader>
            <CardContent>
              {offerAnalytics.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">No offers created yet</p>
                  <Link to="/create-offer">
                    <Button>Create Your First Offer</Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Offer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Trades</TableHead>
                        <TableHead className="text-center">Completed</TableHead>
                        <TableHead className="text-center">Conversion</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-center">Avg Time</TableHead>
                        <TableHead className="text-center">7D</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offerAnalytics.map((offer) => {
                        const info = cryptoInfo[offer.cryptoType] || { 
                          name: offer.cryptoType, 
                          icon: "?", 
                          color: "#888" 
                        };
                        
                        return (
                          <TableRow key={offer.offerId}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                                  style={{ 
                                    backgroundColor: `${info.color}20`, 
                                    color: info.color 
                                  }}
                                >
                                  {info.icon}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant={offer.offerType === "buy" ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {offer.offerType.toUpperCase()}
                                    </Badge>
                                    <span className="font-medium">
                                      {offer.cryptoAmount} {offer.cryptoType}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    @ {offer.fiatCurrency} {offer.pricePerUnit.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={offer.isActive ? "default" : "outline"}>
                                {offer.isActive ? "Active" : "Paused"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {offer.totalTrades}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                {offer.completedTrades}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Progress 
                                  value={offer.conversionRate} 
                                  className="w-16 h-2"
                                />
                                <span className="text-xs font-medium w-10">
                                  {offer.conversionRate.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-medium">
                                {offer.totalVolumeFiat >= 1000
                                  ? `${(offer.totalVolumeFiat / 1000).toFixed(1)}K`
                                  : offer.totalVolumeFiat.toLocaleString()}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">
                                {offer.fiatCurrency}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {offer.avgCompletionTime > 0 ? (
                                <div className="flex items-center justify-center gap-1 text-sm">
                                  <Clock className="w-3 h-3 text-muted-foreground" />
                                  {offer.avgCompletionTime < 60
                                    ? `${Math.round(offer.avgCompletionTime)}m`
                                    : `${(offer.avgCompletionTime / 60).toFixed(1)}h`}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {offer.tradesLast7Days > 0 ? (
                                <Badge variant="outline" className="text-xs">
                                  {offer.tradesLast7Days}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

// Sub-component for offer performance cards
const OfferPerformanceCard = ({ offer }: { offer: OfferAnalytics }) => {
  const info = cryptoInfo[offer.cryptoType] || { 
    name: offer.cryptoType, 
    icon: "?", 
    color: "#888" 
  };

  return (
    <div className="space-y-3 overflow-hidden">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
          style={{ backgroundColor: `${info.color}20`, color: info.color }}
        >
          {info.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={offer.offerType === "buy" ? "default" : "secondary"}>
              {offer.offerType.toUpperCase()}
            </Badge>
            <span className="font-semibold truncate">
              {offer.cryptoAmount} {offer.cryptoType}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            @ {offer.fiatCurrency} {offer.pricePerUnit.toLocaleString()}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{offer.conversionRate.toFixed(0)}%</p>
          <p className="text-xs text-muted-foreground truncate">Conversion</p>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{offer.completedTrades}</p>
          <p className="text-xs text-muted-foreground truncate">Completed</p>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">
            {offer.totalVolumeFiat >= 1000
              ? `${(offer.totalVolumeFiat / 1000).toFixed(0)}K`
              : offer.totalVolumeFiat.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground truncate">Volume</p>
        </div>
      </div>
    </div>
  );
};

export default OfferAnalyticsPage;
