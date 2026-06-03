import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTreasury } from "@/hooks/useTreasury";
import { StatsCard } from "@/components/admin/StatsCard";
import { 
  DollarSign, Wallet, RefreshCw, TrendingUp, Download, 
  Calendar, Filter, ArrowUpRight, ArrowDownRight, Clock,
  Lock, Unlock, FileText, PieChart, Scale
} from "lucide-react";
import { ReconciliationPanel } from "@/components/admin/ReconciliationPanel";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";

const CRYPTO_COLORS: Record<string, string> = {
  BTC: "text-amber-500",
  ETH: "text-blue-500",
  USDT: "text-emerald-500",
};

const CryptoIcon = ({ crypto }: { crypto: string }) => (
  <span className={`font-bold ${CRYPTO_COLORS[crypto] || "text-muted-foreground"}`}>
    {crypto}
  </span>
);

const getLedgerTypeBadge = (type: string) => {
  const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    fee_collected: { label: "Fee", variant: "default" },
    escrow_locked: { label: "Escrow Lock", variant: "secondary" },
    escrow_released: { label: "Escrow Release", variant: "outline" },
    refund_issued: { label: "Refund", variant: "destructive" },
    escrow_in: { label: "Escrow In", variant: "secondary" },
    escrow_out: { label: "Escrow Out", variant: "outline" },
  };
  const config = configs[type] || { label: type, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const formatCryptoAmount = (amount: number, crypto: string) => {
  if (crypto === "BTC") return amount.toFixed(8);
  if (crypto === "ETH") return amount.toFixed(6);
  return amount.toFixed(2);
};

export const AdminTreasury = () => {
  const { platformWallets, ledgerEntries, stats, loading, refetch } = useTreasury();
  const [dateRange, setDateRange] = useState<string>("7d");
  const [cryptoFilter, setCryptoFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getDateRangeFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case "1d": return subDays(now, 1);
      case "7d": return subDays(now, 7);
      case "30d": return subDays(now, 30);
      case "90d": return subDays(now, 90);
      default: return subDays(now, 7);
    }
  };

  const filteredLedger = ledgerEntries.filter(entry => {
    const entryDate = new Date(entry.created_at);
    const rangeStart = startOfDay(getDateRangeFilter());
    const rangeEnd = endOfDay(new Date());
    
    const inDateRange = isWithinInterval(entryDate, { start: rangeStart, end: rangeEnd });
    const matchesCrypto = cryptoFilter === "all" || entry.crypto_type === cryptoFilter;
    const matchesType = typeFilter === "all" || entry.ledger_type === typeFilter;
    const matchesSearch = !searchQuery || 
      entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.trade_id?.includes(searchQuery);
    
    return inDateRange && matchesCrypto && matchesType && matchesSearch;
  });

  const calculateFilteredStats = () => {
    const fees: Record<string, number> = {};
    const escrow: Record<string, number> = {};
    const refunds: Record<string, number> = {};

    filteredLedger.forEach(entry => {
      if (entry.ledger_type === "fee_collected") {
        fees[entry.crypto_type] = (fees[entry.crypto_type] || 0) + Number(entry.amount);
      } else if (entry.ledger_type === "escrow_locked" || entry.ledger_type === "escrow_in") {
        escrow[entry.crypto_type] = (escrow[entry.crypto_type] || 0) + Number(entry.amount);
      } else if (entry.ledger_type === "refund_issued") {
        refunds[entry.crypto_type] = (refunds[entry.crypto_type] || 0) + Number(entry.amount);
      }
    });

    return { fees, escrow, refunds };
  };

  const filteredStats = calculateFilteredStats();

  const exportToCSV = () => {
    const headers = ["Date", "Type", "Crypto", "Amount", "Balance Before", "Balance After", "Trade ID", "Description"];
    const rows = filteredLedger.map(entry => [
      format(new Date(entry.created_at), "yyyy-MM-dd HH:mm:ss"),
      entry.ledger_type,
      entry.crypto_type,
      entry.amount.toString(),
      entry.balance_before.toString(),
      entry.balance_after.toString(),
      entry.trade_id || "",
      entry.description || ""
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `treasury_ledger_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  const feeWallets = platformWallets.filter(w => w.wallet_type === "fees");
  const escrowWallets = platformWallets.filter(w => w.wallet_type === "escrow_pool");
  const refundWallets = platformWallets.filter(w => w.wallet_type === "refunds");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Treasury Dashboard</h1>
          <p className="text-muted-foreground">Platform revenue, fees, and immutable audit ledger</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button variant="default" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Revenue Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Daily Revenue"
          value={Object.entries(stats?.dailyRevenue || {}).map(([c, v]) => `${formatCryptoAmount(v, c)} ${c}`).join(", ") || "0"}
          icon={TrendingUp}
        />
        <StatsCard
          title="Monthly Revenue"
          value={Object.entries(stats?.monthlyRevenue || {}).map(([c, v]) => `${formatCryptoAmount(v, c)} ${c}`).join(", ") || "0"}
          icon={Calendar}
        />
        <StatsCard
          title="All-Time Revenue"
          value={Object.entries(stats?.allTimeRevenue || {}).map(([c, v]) => `${formatCryptoAmount(v, c)} ${c}`).join(", ") || "0"}
          icon={DollarSign}
        />
        <StatsCard
          title="Active Escrow"
          value={Object.entries(stats?.totalEscrowHeld || {}).map(([c, v]) => `${formatCryptoAmount(v, c)} ${c}`).join(", ") || "0"}
          icon={Lock}
        />
      </div>

      <Tabs defaultValue="wallets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="wallets" className="gap-2">
            <Wallet className="h-4 w-4" /> Platform Wallets
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="gap-2">
            <PieChart className="h-4 w-4" /> Fee Breakdown
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2">
            <FileText className="h-4 w-4" /> Audit Ledger
          </TabsTrigger>
        </TabsList>

        {/* Platform Wallets Tab */}
        <TabsContent value="wallets" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Fee Wallets */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> Fee Wallets
                </CardTitle>
                <CardDescription>Collected platform fees</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {feeWallets.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No fee wallets</p>
                ) : (
                  feeWallets.map(w => (
                    <div key={w.id} className="flex justify-between items-center p-2 rounded-lg bg-secondary/50">
                      <CryptoIcon crypto={w.crypto_type} />
                      <span className="font-mono font-semibold">{formatCryptoAmount(Number(w.balance), w.crypto_type)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Escrow Wallets */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-warning" /> Escrow Pool
                </CardTitle>
                <CardDescription>Funds held in escrow</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {escrowWallets.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No escrow wallets</p>
                ) : (
                  escrowWallets.map(w => (
                    <div key={w.id} className="flex justify-between items-center p-2 rounded-lg bg-secondary/50">
                      <CryptoIcon crypto={w.crypto_type} />
                      <span className="font-mono font-semibold">{formatCryptoAmount(Number(w.balance), w.crypto_type)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Refund Wallets */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Unlock className="h-4 w-4 text-destructive" /> Refund Pool
                </CardTitle>
                <CardDescription>Refunds pending/issued</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {refundWallets.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No refund wallets</p>
                ) : (
                  refundWallets.map(w => (
                    <div key={w.id} className="flex justify-between items-center p-2 rounded-lg bg-secondary/50">
                      <CryptoIcon crypto={w.crypto_type} />
                      <span className="font-mono font-semibold">{formatCryptoAmount(Number(w.balance), w.crypto_type)}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Fee Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fee Breakdown by Type</CardTitle>
              <CardDescription>Revenue breakdown for selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border bg-primary/5">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                    <span className="font-medium">Trading Fees</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(filteredStats.fees).map(([crypto, amount]) => (
                      <div key={crypto} className="flex justify-between text-sm">
                        <CryptoIcon crypto={crypto} />
                        <span className="font-mono">{formatCryptoAmount(amount, crypto)}</span>
                      </div>
                    ))}
                    {Object.keys(filteredStats.fees).length === 0 && (
                      <p className="text-muted-foreground text-sm">No fees in period</p>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-warning/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-warning" />
                    <span className="font-medium">Escrow Volume</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(filteredStats.escrow).map(([crypto, amount]) => (
                      <div key={crypto} className="flex justify-between text-sm">
                        <CryptoIcon crypto={crypto} />
                        <span className="font-mono">{formatCryptoAmount(amount, crypto)}</span>
                      </div>
                    ))}
                    {Object.keys(filteredStats.escrow).length === 0 && (
                      <p className="text-muted-foreground text-sm">No escrow in period</p>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-destructive/5">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                    <span className="font-medium">Refunds Issued</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(filteredStats.refunds).map(([crypto, amount]) => (
                      <div key={crypto} className="flex justify-between text-sm">
                        <CryptoIcon crypto={crypto} />
                        <span className="font-mono">{formatCryptoAmount(amount, crypto)}</span>
                      </div>
                    ))}
                    {Object.keys(filteredStats.refunds).length === 0 && (
                      <p className="text-muted-foreground text-sm">No refunds in period</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Ledger Tab */}
        <TabsContent value="ledger" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search by description or trade ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[130px]">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">Last 24h</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={cryptoFilter} onValueChange={setCryptoFilter}>
                  <SelectTrigger className="w-[120px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Crypto</SelectItem>
                    <SelectItem value="BTC">BTC</SelectItem>
                    <SelectItem value="ETH">ETH</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="fee_collected">Fee Collected</SelectItem>
                    <SelectItem value="escrow_locked">Escrow Lock</SelectItem>
                    <SelectItem value="escrow_released">Escrow Release</SelectItem>
                    <SelectItem value="refund_issued">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Ledger Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Immutable Treasury Ledger</span>
                <Badge variant="outline">{filteredLedger.length} entries</Badge>
              </CardTitle>
              <CardDescription>All financial transactions are logged here for audit compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Crypto</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-right p-2">Balance Before</th>
                      <th className="text-right p-2">Balance After</th>
                      <th className="text-left p-2">Trade ID</th>
                      <th className="text-left p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground">
                          No ledger entries found for the selected filters
                        </td>
                      </tr>
                    ) : (
                      filteredLedger.map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-muted/50">
                          <td className="p-2 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(entry.created_at), "MMM d, HH:mm")}
                            </div>
                          </td>
                          <td className="p-2">{getLedgerTypeBadge(entry.ledger_type)}</td>
                          <td className="p-2"><CryptoIcon crypto={entry.crypto_type} /></td>
                          <td className="p-2 text-right font-mono">
                            {formatCryptoAmount(Number(entry.amount), entry.crypto_type)}
                          </td>
                          <td className="p-2 text-right font-mono text-muted-foreground">
                            {formatCryptoAmount(Number(entry.balance_before), entry.crypto_type)}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {formatCryptoAmount(Number(entry.balance_after), entry.crypto_type)}
                          </td>
                          <td className="p-2">
                            {entry.trade_id ? (
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {entry.trade_id.slice(0, 8)}...
                              </code>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground max-w-[200px] truncate">
                            {entry.description || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
