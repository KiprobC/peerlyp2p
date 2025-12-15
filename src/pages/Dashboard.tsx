import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Bell,
  Settings,
  TrendingUp,
  Clock,
  Shield,
  ChevronRight,
  LogOut,
  Menu,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useWallets, cryptoInfo } from "@/hooks/useWallets";
import { useTrades } from "@/hooks/useTrades";
import { useMyOffers } from "@/hooks/useOffers";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

// Mock price data (would come from API in production)
const cryptoPrices: Record<string, number> = {
  BTC: 8250000, // KES
  USDT: 152,
  ETH: 425000,
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { wallets, loading: walletsLoading } = useWallets();
  const { trades, activeTrades, completedTrades, loading: tradesLoading } = useTrades();
  const { offers: myOffers, loading: offersLoading } = useMyOffers();
  const { unreadCount } = useNotifications();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const totalValueKES = wallets.reduce((total, wallet) => {
    const price = cryptoPrices[wallet.crypto_type] || 0;
    return total + wallet.balance * price;
  }, 0);

  const recentTrades = trades.slice(0, 5);

  if (profileLoading || walletsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <Skeleton className="h-8 sm:h-10 w-24 sm:w-32" />
              <Skeleton className="h-8 w-20 sm:w-24" />
            </div>
          </div>
        </nav>
        <main className="pt-20 sm:pt-24 pb-16">
          <div className="container mx-auto px-4 space-y-4 sm:space-y-6">
            <Skeleton className="h-10 sm:h-12 w-48 sm:w-64" />
            <Skeleton className="h-40 sm:h-48 w-full" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Skeleton className="h-28 sm:h-32" />
              <Skeleton className="h-28 sm:h-32" />
              <Skeleton className="h-28 sm:h-32" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-base sm:text-lg">K</span>
              </div>
              <span className="font-bold text-lg sm:text-xl text-foreground hidden xs:block">
                Kenya<span className="text-primary">Coin</span>
              </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link to="/notifications">
                <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Link to="/profile" className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border hover:opacity-80 transition-opacity">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || "U"}
                </div>
                <span className="hidden sm:block text-sm font-medium">
                  {profile?.full_name?.split(" ")[0] || "User"}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 sm:pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-3 sm:px-4">
          {/* Welcome Section */}
          <div className="flex flex-col gap-3 mb-6 sm:mb-8">
            <div>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-bold mb-1">
                Welcome, <span className="gradient-text">{profile?.full_name?.split(" ")[0] || "Trader"}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                {profile?.is_verified && (
                  <div className="flex items-center gap-1 text-primary">
                    <Shield className="w-3 h-3" />
                    <span>Verified</span>
                  </div>
                )}
                <span>⭐ {profile?.rating?.toFixed(1) || "0.0"}</span>
                <span>{profile?.total_trades || 0} trades</span>
              </div>
            </div>
            
            {/* Quick Actions - Grid layout to prevent scroll */}
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <Link to="/my-offers">
                <Button variant="outline" size="sm" className="w-full h-8 text-[10px] sm:text-xs sm:h-9 px-2 sm:px-3">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  <span className="truncate">Offers</span>
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="outline" size="sm" className="w-full h-8 text-[10px] sm:text-xs sm:h-9 px-2 sm:px-3">
                  <ArrowDownLeft className="w-3 h-3 mr-1" />
                  <span className="truncate">Buy</span>
                </Button>
              </Link>
              <Link to="/create-offer">
                <Button variant="default" size="sm" className="w-full h-8 text-[10px] sm:text-xs sm:h-9 px-2 sm:px-3">
                  <Plus className="w-3 h-3 mr-1" />
                  <span className="truncate">Create</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Portfolio Overview */}
          <div className="glass-card mb-6 sm:mb-8 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Portfolio Value</p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
                  KES {totalValueKES.toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/wallet/deposit" className="flex-1 sm:flex-none">
                  <Button variant="default" size="sm" className="w-full sm:w-auto">
                    <ArrowDownLeft className="w-4 h-4 mr-1" />
                    Deposit
                  </Button>
                </Link>
                <Link to="/wallet/withdraw" className="flex-1 sm:flex-none">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    Withdraw
                  </Button>
                </Link>
              </div>
            </div>

            {/* Crypto Balances */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {wallets.length > 0 ? (
                wallets.map((wallet) => {
                  const info = cryptoInfo[wallet.crypto_type] || { name: wallet.crypto_type, icon: "?", color: "#888" };
                  const valueKES = wallet.balance * (cryptoPrices[wallet.crypto_type] || 0);
                  
                  return (
                    <div
                      key={wallet.id}
                      className="bg-secondary/50 rounded-xl p-3 sm:p-4 flex items-center justify-between hover:bg-secondary/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div 
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg font-bold"
                          style={{ backgroundColor: `${info.color}20`, color: info.color }}
                        >
                          {info.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-sm sm:text-base">{wallet.crypto_type}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">{info.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm sm:text-base">{wallet.balance.toFixed(wallet.crypto_type === "USDT" ? 2 : 6)}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          KES {valueKES.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-6 sm:py-8 text-muted-foreground text-sm">
                  No wallets found. Complete your profile setup to get started.
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats & Recent Trades */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Quick Stats */}
            <div className="glass-card p-4 sm:p-6">
              <h3 className="font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Quick Stats
              </h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Active Offers</span>
                  <span className="font-semibold">{myOffers.filter(o => o.is_active).length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Pending Trades</span>
                  <span className="font-semibold">{activeTrades.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Completed Trades</span>
                  <span className="font-semibold">{completedTrades.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-semibold text-primary">
                    {profile?.total_trades ? 
                      `${Math.round((profile.successful_trades / profile.total_trades) * 100)}%` : 
                      "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Trades */}
            <div className="glass-card lg:col-span-2 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Recent Trades
                </h3>
                <Link to="/trades" className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </Link>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {tradesLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 sm:h-16 w-full" />
                  ))
                ) : recentTrades.length > 0 ? (
                  recentTrades.map((trade) => {
                    const isBuyer = trade.buyer_id === user?.id;
                    const tradeType = isBuyer ? "buy" : "sell";
                    
                    return (
                      <Link
                        key={trade.id}
                        to={`/trade/${trade.id}`}
                        className="flex items-center justify-between p-2.5 sm:p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                            isBuyer ? "bg-primary/20" : "bg-destructive/20"
                          }`}>
                            {isBuyer ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium capitalize text-sm">{tradeType} {trade.crypto_type}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{trade.crypto_amount} {trade.crypto_type}</p>
                          <Badge 
                            variant={trade.status === "completed" ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {trade.status}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                    No trades yet. Start trading in the marketplace!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
