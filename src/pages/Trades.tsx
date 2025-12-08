import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTrades } from "@/hooks/useTrades";
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  confirmed: { label: "Confirmed", variant: "default" },
  payment_sent: { label: "Payment Sent", variant: "default" },
  completed: { label: "Completed", variant: "default" },
  disputed: { label: "Disputed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

const Trades = () => {
  const { user } = useAuth();
  const { trades, activeTrades, completedTrades, loading } = useTrades();

  const cancelledTrades = trades.filter((t) => t.status === "cancelled");
  const disputedTrades = trades.filter((t) => t.status === "disputed");

  const TradeCard = ({ trade }: { trade: typeof trades[0] }) => {
    const isBuyer = trade.buyer_id === user?.id;
    const status = statusConfig[trade.status] || statusConfig.pending;

    return (
      <Link
        to={`/trade/${trade.id}`}
        className="glass-card hover:border-primary/30 transition-all block"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isBuyer ? "bg-primary/20" : "bg-destructive/20"
              }`}
            >
              {isBuyer ? (
                <ArrowDownLeft className="w-5 h-5 text-primary" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-destructive" />
              )}
            </div>
            <div>
              <p className="font-semibold">
                {isBuyer ? "Buying" : "Selling"} {trade.crypto_amount} {trade.crypto_type}
              </p>
              <p className="text-sm text-muted-foreground">
                {trade.fiat_currency} {trade.fiat_amount.toLocaleString()} • {trade.payment_method}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={status.variant}>{status.label}</Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold ml-2">My Trades</h1>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="active" className="relative">
                Active
                {activeTrades.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                    {activeTrades.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="disputed">Disputed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))
              ) : activeTrades.length > 0 ? (
                activeTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No active trades</p>
                  <Link to="/marketplace">
                    <Button variant="outline" className="mt-4">
                      Browse Marketplace
                    </Button>
                  </Link>
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))
              ) : completedTrades.length > 0 ? (
                completedTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No completed trades yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="disputed" className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))
              ) : disputedTrades.length > 0 ? (
                disputedTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No disputed trades</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="cancelled" className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))
              ) : cancelledTrades.length > 0 ? (
                cancelledTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <XCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No cancelled trades</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Trades;
