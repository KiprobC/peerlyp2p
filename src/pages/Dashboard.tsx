import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import peerlyLogo from "@/assets/peerly-logo.png";
import peerlyIcon from "@/assets/peerly-icon.png";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton, TradeCardSkeleton } from "@/components/loaders";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, CreditCard, Eye, EyeOff, LayoutDashboard,
  MessageCircle, Settings, Shield, Store, TrendingUp, User, Wallet, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useWallets, cryptoInfo } from "@/hooks/useWallets";
import { useTrades } from "@/hooks/useTrades";
import { useMyOffers } from "@/hooks/useOffers";
import { useNotifications } from "@/hooks/useNotifications";
import { useCryptoPrices, USD_TO_KES } from "@/hooks/useCryptoPrices";
import { useSettings } from "@/hooks/useSettings";
import { useTraderStats } from "@/hooks/useTraderStats";
import { usePortfolio } from "@/hooks/usePortfolio";
import { SendCryptoDialog } from "@/components/wallet/SendCryptoDialog";
import { ProfilePopover } from "@/components/layout/ProfilePopover";
import { ConnectivityIndicator } from "@/components/connectivity/ConnectivityIndicator";
import SupportChatDialog from "@/components/support/SupportChatDialog";
import { formatDistanceToNow } from "date-fns";
import { formatCompact, formatExact, formatGrouped } from "@/lib/formatNumber";

const BALANCE_HIDDEN_KEY = "peerly_balance_hidden";

const formatHeaderBalance = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return formatCompact(value);
  return formatGrouped(value, 2, 2);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { wallets, loading: walletsLoading, refetch: refetchWallets } = useWallets();
  const { trades, activeTrades, loading: tradesLoading } = useTrades();
  const { offers: myOffers } = useMyOffers();
  const { unreadCount } = useNotifications();
  const { settings } = useSettings();
  const { stats: traderStats } = useTraderStats();
  const preferredCurrency = (settings?.preferred_currency || "KES") as import("@/hooks/usePortfolio").DisplayCurrency;
  const portfolio = usePortfolio(preferredCurrency);
  const { prices: cryptoPricesUSD, changes: priceChanges } = useCryptoPrices();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(() => localStorage.getItem(BALANCE_HIDDEN_KEY) === "true");

  const totalPortfolioValue = portfolio.totalValue;
  const currencySymbol = portfolio.currencySymbol;
  const conversionRate = preferredCurrency === "KES" ? USD_TO_KES : 1;
  const assetValueMap: Record<string, number> = Object.fromEntries(portfolio.assets.map((asset) => [asset.crypto_type, asset.valueInCurrency]));
  const recentTrades = trades.slice(0, 5);

  const toggleBalanceVisibility = () => {
    const next = !balanceHidden;
    setBalanceHidden(next);
    localStorage.setItem(BALANCE_HIDDEN_KEY, String(next));
  };

  const formatBalance = (value: number | string, decimals?: number) => {
    if (balanceHidden) return "••••••";
    return typeof value === "number" ? (decimals !== undefined ? value.toFixed(decimals) : value.toLocaleString()) : value;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (profileLoading || walletsLoading || portfolio.loading) return <DashboardSkeleton />;

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
    { label: "Marketplace", icon: Store, to: "/marketplace" },
    { label: "Trades", icon: ArrowRight, to: "/trades" },
    { label: "Wallet", icon: Wallet, to: "/wallet/deposit" },
  ];

  const renderMarketCard = (crypto: string) => {
    const info = cryptoInfo[crypto];
    const price = (cryptoPricesUSD[crypto] || 0) * conversionRate;
    const change = priceChanges[crypto] || 0;
    const positive = change >= 0;
    return (
      <div key={crypto} className="rounded-xl border border-border/70 bg-secondary/25 p-4 transition-colors hover:bg-secondary/45">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: `${info.color}20`, color: info.color }}>{info.icon}</span>
            <div><p className="font-semibold">{crypto}/KES</p><p className="text-xs text-muted-foreground">{info.name}</p></div>
          </div>
          <span className={`text-xs font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>{positive ? "+" : ""}{change.toFixed(2)}%</span>
        </div>
        <p className="mt-4 text-lg font-semibold tabular-nums">{currencySymbol}{price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        <div className="mt-3 flex h-7 items-end gap-1 opacity-70" aria-label={`${crypto} price trend`}>
          {[28, 42, 34, 52, 44, 62, 56, positive ? 72 : 38].map((height, index) => <span key={index} className={`flex-1 rounded-t-sm ${positive ? "bg-emerald-400/70" : "bg-red-400/70"}`} style={{ height: `${height}%` }} />)}
        </div>
      </div>
    );
  };

  const DesktopSidebar = () => (
    <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r border-border/70 bg-card/95 backdrop-blur-xl md:flex md:flex-col transition-[width] duration-200 ${sidebarCollapsed ? "w-14" : "w-44"}`}>
      <div className="flex h-20 items-center border-b border-border/60 px-3"><Link to="/dashboard" className="flex min-w-0 items-center gap-2"><img src={sidebarCollapsed ? peerlyIcon : peerlyLogo} alt="Peerly" className={sidebarCollapsed ? "h-7 w-7 rounded-lg" : "h-8 w-auto max-w-[120px] object-contain object-left"} />{!sidebarCollapsed && <span className="sr-only">Peerly</span>}</Link></div>
      <nav className={`flex-1 space-y-1 py-6 ${sidebarCollapsed ? "px-1.5" : "px-3"}`}>
        <p className={`mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground ${sidebarCollapsed ? "sr-only" : ""}`}>Workspace</p>
        {navItems.map((item) => { const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to)); return <Link key={item.to} to={item.to} title={sidebarCollapsed ? item.label : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}><item.icon className="h-5 w-5 shrink-0" />{!sidebarCollapsed && <span>{item.label}</span>}</Link>; })}
        <button onClick={() => setSupportOpen(true)} title={sidebarCollapsed ? "Messages" : undefined} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><MessageCircle className="h-5 w-5 shrink-0" />{!sidebarCollapsed && <span>Messages</span>}</button>
        <Link to="/notifications" title={sidebarCollapsed ? "Notifications" : undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><span className="relative"><Bell className="h-5 w-5 shrink-0" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />}</span>{!sidebarCollapsed && <span>Notifications</span>}</Link>
      </nav>
      <div className={`space-y-1 border-t border-border/60 py-5 ${sidebarCollapsed ? "px-1.5" : "px-3"}`}>
        <Link to="/settings" title={sidebarCollapsed ? "Settings" : undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><Settings className="h-5 w-5 shrink-0" />{!sidebarCollapsed && <span>Settings</span>}</Link>
        <Link to="/profile" title={sidebarCollapsed ? "Profile" : undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><User className="h-5 w-5 shrink-0" />{!sidebarCollapsed && <span>Profile</span>}</Link>
        <Link to="/how-it-works" title={sidebarCollapsed ? "Help" : undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"><CircleHelp className="h-5 w-5 shrink-0" />{!sidebarCollapsed && <span>Help & FAQ</span>}</Link>
        <button onClick={handleSignOut} title={sidebarCollapsed ? "Sign out" : undefined} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-5 w-5 shrink-0" />{!sidebarCollapsed && <span>Sign out</span>}</button>
      </div>
    </aside>
  );

  const DesktopDashboard = () => (
    <div className="hidden min-h-screen bg-background md:block">
      <DesktopSidebar />
      <div className={`min-h-screen transition-[margin] duration-200 ${sidebarCollapsed ? "md:ml-14" : "md:ml-44"}`}>
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl"><div className="flex min-h-20 items-center justify-between gap-5 px-6 py-4 xl:px-10"><div className="flex min-w-0 items-center gap-4"><Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} aria-label="Toggle sidebar" className="shrink-0">{sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}</Button><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Peerly</p><h1 className="truncate text-xl font-semibold">Welcome back, @{profile?.username || "Trader"}</h1></div></div><div className="flex items-center gap-3"><ConnectivityIndicator /><Link to="/notifications" className="relative"><Button variant="outline" size="icon" className="rounded-xl"><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />}</Button></Link><button onClick={toggleBalanceVisibility} className="hidden items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm font-semibold xl:flex" title={balanceHidden ? "Show balance" : `${currencySymbol}${formatExact(totalPortfolioValue)}`}><Wallet className="h-4 w-4 text-primary" /><span>{balanceHidden ? "••••••" : `${currencySymbol}${formatHeaderBalance(totalPortfolioValue)}`}</span>{balanceHidden ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}</button><ProfilePopover /></div></div></header>
        <main className="px-6 py-7 xl:px-10"><div className="mx-auto max-w-[1600px] space-y-7">
          <section className="grid grid-cols-12 gap-5"><div className="col-span-12 rounded-2xl border border-border/70 bg-card p-6 shadow-[0_18px_60px_-40px_hsl(var(--primary)/0.5)] lg:col-span-7"><div className="flex flex-wrap items-start justify-between gap-5"><div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />Total portfolio balance<button onClick={toggleBalanceVisibility} aria-label="Toggle balance visibility" className="text-muted-foreground hover:text-foreground">{balanceHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><p className="text-4xl font-semibold tracking-tight">{currencySymbol}{formatBalance(totalPortfolioValue)}</p><p className="mt-2 text-sm text-emerald-400">Live valuation across {portfolio.assets.length} assets</p></div><div className="rounded-xl bg-primary/10 p-3 text-primary"><TrendingUp className="h-6 w-6" /></div></div><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4"><Link to="/marketplace?intent=buy"><Button className="w-full" size="sm"><ArrowDownLeft className="mr-1.5 h-4 w-4" />Buy</Button></Link><Link to="/marketplace?intent=sell"><Button className="w-full" variant="outline" size="sm"><ArrowUpRight className="mr-1.5 h-4 w-4" />Sell</Button></Link><Link to="/wallet/deposit"><Button className="w-full" variant="outline" size="sm"><ArrowDownLeft className="mr-1.5 h-4 w-4" />Deposit</Button></Link><Link to="/wallet/withdraw"><Button className="w-full" variant="outline" size="sm"><ArrowUpRight className="mr-1.5 h-4 w-4" />Withdraw</Button></Link></div></div><div className="col-span-12 grid grid-cols-2 gap-4 lg:col-span-5"><div className="rounded-2xl border border-border/70 bg-card p-5"><p className="text-sm text-muted-foreground">Available assets</p><p className="mt-3 text-2xl font-semibold">{portfolio.assets.length}</p><p className="mt-1 text-xs text-muted-foreground">Across active wallets</p></div><div className="rounded-2xl border border-border/70 bg-card p-5"><p className="text-sm text-muted-foreground">Pending trades</p><p className="mt-3 text-2xl font-semibold">{activeTrades.length}</p><p className="mt-1 text-xs text-muted-foreground">Need your attention</p></div><div className="col-span-2 rounded-2xl border border-border/70 bg-card p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Trading performance</p><Badge variant="secondary">{traderStats.totalTrades} total trades</Badge></div><div className="mt-4 flex items-end justify-between"><p className="text-2xl font-semibold">{traderStats.totalTrades > 0 ? `${traderStats.successRate}%` : "N/A"}</p><p className="text-sm text-primary">{traderStats.rating?.toFixed(1) || "0.0"} rating</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Number(traderStats.successRate) || 0, 100)}%` }} /></div></div></div></section>
          <section className="rounded-2xl border border-border/70 bg-card p-5 xl:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Market overview</p><h2 className="mt-1 text-xl font-semibold">Live markets</h2></div><Link to="/marketplace" className="text-sm font-medium text-primary hover:underline">Open marketplace <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div><div className="grid grid-cols-1 gap-4 md:grid-cols-3">{["BTC", "ETH", "USDT"].map(renderMarketCard)}</div></section>
          <section className="grid grid-cols-12 gap-5"><div className="col-span-12 min-w-0 rounded-2xl border border-border/70 bg-card p-5 xl:col-span-9 xl:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Activity</p><h2 className="mt-1 text-xl font-semibold">Active trades</h2></div><Link to="/trades" className="text-sm font-medium text-primary hover:underline">View all <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border/70 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-medium">Trade</th><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Amount</th><th className="pb-3 font-medium">Type</th><th className="pb-3 font-medium">Status</th><th className="pb-3 font-medium">Created</th><th className="pb-3 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-border/60">{tradesLoading ? <tr><td colSpan={7} className="py-8"><TradeCardSkeleton count={2} /></td></tr> : activeTrades.length > 0 ? activeTrades.slice(0, 8).map((trade) => { const isBuyer = trade.buyer_id === user?.id; return <tr key={trade.id} className="group"><td className="py-4 font-medium">#{trade.id.slice(0, 8)}</td><td className="py-4 font-semibold">{trade.crypto_type}</td><td className="py-4 tabular-nums">{trade.crypto_amount}</td><td className="py-4"><span className={isBuyer ? "text-primary" : "text-destructive"}>{isBuyer ? "Buying" : "Selling"}</span></td><td className="py-4"><Badge variant={trade.status === "disputed" ? "destructive" : "secondary"}>{trade.status.replaceAll("_", " ")}</Badge></td><td className="py-4 text-muted-foreground">{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</td><td className="py-4 text-right"><Link to={`/trade/${trade.id}`} className="font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Open <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link></td></tr>; }) : <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No active trades right now.</td></tr>}</tbody></table></div></div><aside className="col-span-12 space-y-5 xl:col-span-3"><div className="rounded-2xl border border-border/70 bg-card p-5"><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><h2 className="font-semibold">Account & security</h2></div><div className="mt-5 space-y-4"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Identity</span><span className={profile?.is_verified ? "text-emerald-400" : "text-amber-400"}>{profile?.is_verified ? "Verified" : "Incomplete"}</span></div><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Profile</span><span className="text-primary">{profile?.setup_completed ? "Complete" : "In progress"}</span></div><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Notifications</span><span className="font-medium">{unreadCount} unread</span></div></div><Link to="/profile" className="mt-5 block text-sm font-medium text-primary hover:underline">Review account <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div><div className="rounded-2xl border border-border/70 bg-card p-5"><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><h2 className="font-semibold">Shortcuts</h2></div><div className="mt-4 space-y-2"><Link to="/my-offers" className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-3 text-sm hover:bg-secondary"><span>My active offers</span><span className="font-semibold">{myOffers.filter((offer) => offer.is_active).length}</span></Link><Link to="/wallet/history" className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-3 text-sm hover:bg-secondary"><span>Wallet history</span><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link></div></div></aside></section>
          <section className="rounded-2xl border border-border/70 bg-card p-5 xl:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Recent activity</p><h2 className="mt-1 text-xl font-semibold">Latest trades</h2></div><Link to="/trades" className="text-sm font-medium text-primary hover:underline">View all <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border/70 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-medium">Trade ID</th><th className="pb-3 font-medium">Direction</th><th className="pb-3 font-medium">Asset</th><th className="pb-3 font-medium">Amount</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">When</th></tr></thead><tbody className="divide-y divide-border/60">{recentTrades.length > 0 ? recentTrades.map((trade) => { const isBuyer = trade.buyer_id === user?.id; return <tr key={trade.id}><td className="py-4 font-medium">#{trade.id.slice(0, 8)}</td><td className="py-4"><span className={isBuyer ? "text-primary" : "text-destructive"}>{isBuyer ? "Buy" : "Sell"}</span></td><td className="py-4 font-semibold">{trade.crypto_type}</td><td className="py-4 tabular-nums">{trade.crypto_amount}</td><td className="py-4"><Badge variant={trade.status === "completed" ? "default" : "secondary"}>{trade.status.replaceAll("_", " ")}</Badge></td><td className="py-4 text-right text-muted-foreground">{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</td></tr>; }) : <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">No recent activity yet.</td></tr>}</tbody></table></div></section>
        </div></main>
      </div>
    </div>
  );

  const MobileDashboard = () => (
    <div className="min-h-screen bg-background md:hidden"><nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl"><div className="flex h-14 items-center justify-between px-3"><Link to="/dashboard" className="flex items-center gap-2"><img src={peerlyIcon} alt="Peerly" className="h-7 w-7 rounded-lg" /><span className="text-lg font-bold">Peerly</span></Link><div className="flex items-center gap-2"><ConnectivityIndicator /><Link to="/notifications" className="relative"><Button variant="ghost" size="icon" className="h-9 w-9"><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />}</Button></Link><ProfilePopover compact /></div></div></nav><main className="space-y-5 px-3 pb-24 pt-20"><div><h1 className="text-xl font-bold">Welcome, <span className="gradient-text">@{profile?.username || "Trader"}</span></h1><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">{profile?.is_verified && <span className="flex items-center gap-1 text-primary"><Shield className="h-3 w-3" />Verified</span>}<span>⭐ {traderStats.rating?.toFixed(1) || "0.0"}</span><span>{traderStats.totalTrades} trades</span></div></div><div className="grid grid-cols-2 gap-2"><Link to="/marketplace?intent=buy"><Button variant="outline" size="sm" className="w-full"><ArrowDownLeft className="mr-1 h-3.5 w-3.5" />Buy</Button></Link><Link to="/marketplace?intent=sell"><Button variant="outline" size="sm" className="w-full"><ArrowUpRight className="mr-1 h-3.5 w-3.5" />Sell</Button></Link><Link to="/wallet/deposit"><Button variant="outline" size="sm" className="w-full"><ArrowDownLeft className="mr-1 h-3.5 w-3.5" />Deposit</Button></Link><Link to="/wallet/withdraw"><Button variant="outline" size="sm" className="w-full"><ArrowUpRight className="mr-1 h-3.5 w-3.5" />Withdraw</Button></Link></div><div className="glass-card p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">Total Portfolio Value</p><p className="mt-1 text-2xl font-bold">{currencySymbol}{formatBalance(totalPortfolioValue)}</p></div><button onClick={toggleBalanceVisibility} aria-label="Toggle balance visibility" className="text-muted-foreground">{balanceHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div><div className="mt-4 flex flex-wrap gap-2 text-xs">{Object.entries(cryptoInfo).map(([crypto, info]) => <div key={crypto} className="flex items-center gap-1.5 rounded-lg bg-secondary/50 px-2 py-1.5"><span style={{ color: info.color }}>{info.icon}</span><span>{currencySymbol}{((cryptoPricesUSD[crypto] || 0) * conversionRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>)}</div><div className="mt-3 grid grid-cols-1 gap-2">{wallets.length > 0 ? wallets.map((wallet) => { const info = cryptoInfo[wallet.crypto_type] || { name: wallet.crypto_type, icon: "?", color: "#888" }; return <div key={wallet.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: `${info.color}20`, color: info.color }}>{info.icon}</span><div><p className="text-sm font-semibold">{wallet.crypto_type}</p><p className="text-xs text-muted-foreground">{info.name}</p></div></div><div className="text-right"><p className="text-sm font-semibold">{formatBalance(wallet.balance, wallet.crypto_type === "USDT" ? 2 : 6)}</p><p className="text-xs text-muted-foreground">{currencySymbol}{formatBalance(assetValueMap[wallet.crypto_type] || 0)}</p></div></div>; }) : <p className="py-5 text-center text-sm text-muted-foreground">No wallets found.</p>}</div></div><div className="glass-card p-4"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4 text-primary" />Recent Trades</h2><Link to="/trades" className="text-xs text-primary">View All</Link></div><div className="space-y-2">{recentTrades.length > 0 ? recentTrades.map((trade) => { const isBuyer = trade.buyer_id === user?.id; return <Link key={trade.id} to={`/trade/${trade.id}`} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${isBuyer ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>{isBuyer ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div><p className="text-xs font-medium">{isBuyer ? "Buying" : "Selling"} {trade.crypto_amount} {trade.crypto_type}</p><p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}</p></div></div><Badge variant={trade.status === "completed" ? "default" : "secondary"} className="text-[10px]">{trade.status}</Badge></Link>; }) : <p className="py-6 text-center text-sm text-muted-foreground">No trades yet.</p>}</div></div></main></div>
  );

  return <><DesktopDashboard /><MobileDashboard /><SendCryptoDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen} wallets={wallets} onSuccess={refetchWallets} /><SupportChatDialog open={supportOpen} onOpenChange={setSupportOpen} /></>;
};

export default Dashboard;
