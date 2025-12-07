import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Bitcoin,
  DollarSign,
} from "lucide-react";

// Mock data
const walletBalances = [
  { crypto: "BTC", name: "Bitcoin", balance: 0.0234, valueKES: 193000, change: +2.4, icon: Bitcoin },
  { crypto: "USDT", name: "Tether", balance: 450.0, valueKES: 68400, change: -0.1, icon: DollarSign },
  { crypto: "ETH", name: "Ethereum", balance: 0.15, valueKES: 63750, change: +5.2, icon: TrendingUp },
];

const recentTrades = [
  { id: "1", type: "buy", crypto: "BTC", amount: 0.01, fiat: 82500, status: "completed", date: "2 hours ago" },
  { id: "2", type: "sell", crypto: "USDT", amount: 200, fiat: 30400, status: "completed", date: "5 hours ago" },
  { id: "3", type: "buy", crypto: "ETH", amount: 0.05, fiat: 21250, status: "pending", date: "1 day ago" },
];

const Dashboard = () => {
  const [user] = useState({
    name: "John Kamau",
    verified: true,
    rating: 4.8,
    trades: 47,
  });

  const totalValueKES = walletBalances.reduce((acc, b) => acc + b.valueKES, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">K</span>
              </div>
              <span className="font-bold text-xl text-foreground hidden sm:block">
                Kenya<span className="text-primary">Coin</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 pl-3 border-l border-border">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                  {user.name.charAt(0)}
                </div>
                <span className="hidden sm:block text-sm font-medium">{user.name}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Welcome Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                Welcome back, <span className="gradient-text">{user.name.split(" ")[0]}</span>
              </h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {user.verified && (
                  <div className="flex items-center gap-1 text-primary">
                    <Shield className="w-4 h-4" />
                    <span>Verified</span>
                  </div>
                )}
                <span>⭐ {user.rating} rating</span>
                <span>{user.trades} trades</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/marketplace">
                <Button variant="outline">
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                  Buy Crypto
                </Button>
              </Link>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Create Offer
              </Button>
            </div>
          </div>

          {/* Portfolio Overview */}
          <div className="glass-card mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Portfolio Value</p>
                <p className="text-3xl md:text-4xl font-bold">
                  KES {totalValueKES.toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="buy" size="sm">
                  <ArrowDownLeft className="w-4 h-4 mr-1" />
                  Deposit
                </Button>
                <Button variant="outline" size="sm">
                  <ArrowUpRight className="w-4 h-4 mr-1" />
                  Withdraw
                </Button>
              </div>
            </div>

            {/* Crypto Balances */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {walletBalances.map((wallet) => (
                <div
                  key={wallet.crypto}
                  className="bg-secondary/50 rounded-xl p-4 flex items-center justify-between hover:bg-secondary/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <wallet.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{wallet.crypto}</p>
                      <p className="text-sm text-muted-foreground">{wallet.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{wallet.balance}</p>
                    <p className={`text-sm ${wallet.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {wallet.change >= 0 ? '+' : ''}{wallet.change}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats & Recent Trades */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Stats */}
            <div className="glass-card">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Quick Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Active Offers</span>
                  <span className="font-semibold">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pending Trades</span>
                  <span className="font-semibold">1</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">This Month Volume</span>
                  <span className="font-semibold">KES 245,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <span className="font-semibold text-success">98%</span>
                </div>
              </div>
            </div>

            {/* Recent Trades */}
            <div className="glass-card lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Recent Trades
                </h3>
                <Link to="/trades" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View All <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {recentTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        trade.type === 'buy' ? 'bg-success/20' : 'bg-destructive/20'
                      }`}>
                        {trade.type === 'buy' ? (
                          <ArrowDownLeft className={`w-4 h-4 text-success`} />
                        ) : (
                          <ArrowUpRight className={`w-4 h-4 text-destructive`} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">{trade.type} {trade.crypto}</p>
                        <p className="text-sm text-muted-foreground">{trade.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{trade.amount} {trade.crypto}</p>
                      <Badge variant={trade.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                        {trade.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
