import { useTreasury } from "@/hooks/useTreasury";
import { StatsCard } from "@/components/admin/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet, TrendingUp, Clock, DollarSign, Lock, RefreshCcw, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { format } from "date-fns";

const CryptoIcon = ({ crypto }: { crypto: string }) => {
  const colors: Record<string, string> = {
    BTC: "text-orange-500",
    USDT: "text-green-500",
    ETH: "text-purple-500"
  };
  return <span className={`font-bold ${colors[crypto] || "text-muted-foreground"}`}>{crypto}</span>;
};

export const AdminTreasury = () => {
  const { platformWallets, ledgerEntries, stats, loading } = useTreasury();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const feeWallets = platformWallets.filter(w => w.wallet_type === 'fees');
  const escrowWallets = platformWallets.filter(w => w.wallet_type === 'escrow_pool');
  const refundWallets = platformWallets.filter(w => w.wallet_type === 'refunds');

  const getLedgerTypeBadge = (type: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      fee_collected: { variant: "default", label: "Fee Collected" },
      escrow_in: { variant: "secondary", label: "Escrow In" },
      escrow_out: { variant: "outline", label: "Escrow Out" },
      refund: { variant: "destructive", label: "Refund" },
      adjustment: { variant: "secondary", label: "Adjustment" },
      dispute_resolution: { variant: "outline", label: "Dispute" }
    };
    const config = variants[type] || { variant: "default", label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Treasury</h1>
        <p className="text-muted-foreground">Platform financial overview and immutable ledger</p>
      </div>

      {/* Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Daily Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats && Object.entries(stats.dailyRevenue).map(([crypto, amount]) => (
              <div key={crypto} className="flex items-center justify-between">
                <CryptoIcon crypto={crypto} />
                <span className="font-mono">{Number(amount).toFixed(6)}</span>
              </div>
            ))}
            {(!stats || Object.keys(stats.dailyRevenue).length === 0) && (
              <span className="text-muted-foreground text-sm">No revenue today</span>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats && Object.entries(stats.monthlyRevenue).map(([crypto, amount]) => (
              <div key={crypto} className="flex items-center justify-between">
                <CryptoIcon crypto={crypto} />
                <span className="font-mono">{Number(amount).toFixed(6)}</span>
              </div>
            ))}
            {(!stats || Object.keys(stats.monthlyRevenue).length === 0) && (
              <span className="text-muted-foreground text-sm">No revenue this month</span>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              All-Time Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats && Object.entries(stats.allTimeRevenue).map(([crypto, amount]) => (
              <div key={crypto} className="flex items-center justify-between">
                <CryptoIcon crypto={crypto} />
                <span className="font-mono">{Number(amount).toFixed(6)}</span>
              </div>
            ))}
            {(!stats || Object.keys(stats.allTimeRevenue).length === 0) && (
              <span className="text-muted-foreground text-sm">No revenue recorded</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Wallets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fees Wallet */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-green-500" />
              Collected Fees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {feeWallets.map(wallet => (
              <div key={wallet.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <CryptoIcon crypto={wallet.crypto_type} />
                <span className="font-mono text-lg">{Number(wallet.balance).toFixed(6)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Escrow Pool */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="h-4 w-4 text-yellow-500" />
              Escrow Pool
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {escrowWallets.map(wallet => (
              <div key={wallet.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <CryptoIcon crypto={wallet.crypto_type} />
                <span className="font-mono text-lg">{Number(wallet.balance).toFixed(6)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Refunds */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-red-500" />
              Pending Refunds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {refundWallets.map(wallet => (
              <div key={wallet.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <CryptoIcon crypto={wallet.crypto_type} />
                <span className="font-mono text-lg">{Number(wallet.balance).toFixed(6)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Fee Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Fee Breakdown by Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Trade Fees</p>
              <p className="text-2xl font-bold">1%</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Deposit Fees</p>
              <p className="text-2xl font-bold">0%</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Withdrawal Fees</p>
              <p className="text-2xl font-bold">0.5%</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Escrow Fees</p>
              <p className="text-2xl font-bold">0%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Immutable Treasury Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Treasury Ledger (Immutable)</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {ledgerEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No ledger entries yet</p>
              ) : (
                ledgerEntries.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-3">
                      {Number(entry.amount) > 0 ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        {getLedgerTypeBadge(entry.ledger_type)}
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${Number(entry.amount) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {Number(entry.amount) > 0 ? '+' : ''}{Number(entry.amount).toFixed(6)}
                        </span>
                        <CryptoIcon crypto={entry.crypto_type} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Before: {Number(entry.balance_before).toFixed(6)} → After: {Number(entry.balance_after).toFixed(6)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
