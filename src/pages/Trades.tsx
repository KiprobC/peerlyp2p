import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TradeCardSkeleton } from "@/components/loaders";
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
    const counterparty = isBuyer ? trade.seller_profile : trade.buyer_profile;

    return (
      <Link
        to={`/trade/${trade.id}`}
        className="glass-card hover:border-primary/30 transition-all block p-3 sm:p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                isBuyer ? "bg-primary/20" : "bg-destructive/20"
              }`}
            >
              {isBuyer ? (
                <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              ) : (
                <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm sm:text-base truncate">
                {isBuyer ? "Buying" : "Selling"} {trade.crypto_amount} {trade.crypto_type}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {isBuyer ? "from" : "to"} @{counterparty?.username || "Unknown"} • {trade.payment_method}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
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
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center h-14 sm:h-16">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-base sm:text-lg font-semibold ml-1 sm:ml-2">My Trades</h1>
          </div>
        </div>
      </nav>

      <main className="pt-20 sm:pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-3 sm:px-4 max-w-2xl">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4 sm:mb-6 h-auto p-1">
              <TabsTrigger value="active" className="relative text-xs sm:text-sm py-2 px-1 sm:px-3">
                <span className="truncate">Active</span>
                {activeTrades.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-primary text-primary-foreground text-[10px] sm:text-xs rounded-full flex items-center justify-center">
                    {activeTrades.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                <span className="truncate">Done</span>
              </TabsTrigger>
              <TabsTrigger value="disputed" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                <span className="truncate">Disputed</span>
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
                <span className="truncate">Cancelled</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3 sm:space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 sm:h-24" />
                ))
              ) : activeTrades.length > 0 ? (
                activeTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
              ) : (
                <div className="text-center py-10 sm:py-12 text-muted-foreground">
                  <Clock className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No active trades</p>
                  <Link to="/marketplace">
                    <Button variant="outline" className="mt-4 text-sm">
                      Browse Marketplace
                    </Button>
                  </Link>
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-3 sm:space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 sm:h-24" />
                ))
              ) : completedTrades.length > 0 ? (
                completedTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
              ) : (
                <div className="text-center py-10 sm:py-12 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No completed trades yet</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="disputed" className="space-y-3 sm:space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 sm:h-24" />
                ))
              ) : disputedTrades.length > 0 ? (
                disputedTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
              ) : (
                <div className="text-center py-10 sm:py-12 text-muted-foreground">
                  <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No disputed trades</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="cancelled" className="space-y-3 sm:space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 sm:h-24" />
                ))
              ) : cancelledTrades.length > 0 ? (
                cancelledTrades.map((trade) => <TradeCard key={trade.id} trade={trade} />)
              ) : (
                <div className="text-center py-10 sm:py-12 text-muted-foreground">
                  <XCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">No cancelled trades</p>
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
