import { Link, useLocation } from "react-router-dom";
import { Beaker, ShieldAlert, Activity, LifeBuoy } from "lucide-react";
import { 
  LayoutDashboard, 
  Users, 
  AlertTriangle, 
  BarChart3, 
  ArrowLeft, 
  Package, 
  ArrowRightLeft,
  Wallet,
  Receipt,
  Bell,
  Settings,
  Shield,
  LogOut,
  Percent,
  Lock,
  Menu,
  Landmark,
  UserCheck,
  FileCheck,
  Globe,
  Crown,
  MessageCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useAdminPendingCounts, AdminPendingCounts } from "@/hooks/useAdminPendingCounts";

type BadgeKey = "kyc" | "disputes" | "treasury" | "recovery" | "support" | "risk";

interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: BadgeKey;
}

const badgeCount = (key: BadgeKey | undefined, counts: AdminPendingCounts): number => {
  if (!key) return 0;
  if (key === "treasury") return counts.deposits + counts.withdrawals;
  return counts[key] ?? 0;
};

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
    ],
  },
  {
    title: "Management",
    items: [
      { href: "/admin/users", icon: Users, label: "Users" },
      { href: "/admin/roles", icon: Crown, label: "Role Management" },
      { href: "/admin/offers", icon: Package, label: "Offers" },
      { href: "/admin/trades", icon: ArrowRightLeft, label: "Trades" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/wallets", icon: Wallet, label: "Wallets" },
      { href: "/admin/transactions", icon: Receipt, label: "Transactions" },
      { href: "/admin/deposits", icon: Wallet, label: "Deposit Addresses" },
      { href: "/admin/fees", icon: Percent, label: "Fee Management" },
      { href: "/admin/escrow", icon: Lock, label: "Escrow Management" },
      { href: "/admin/treasury", icon: Landmark, label: "Treasury (Ledger)" },
      { href: "/admin/treasury-overview", icon: BarChart3, label: "Treasury Overview" },
      { href: "/admin/manual-treasury", icon: Wallet, label: "Manual Treasury", badge: "treasury" },
      { href: "/admin/withdrawal-limits", icon: Percent, label: "Withdrawal Limits" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/admin/support", icon: MessageCircle, label: "Support Chat", badge: "support" },
      { href: "/admin/disputes", icon: AlertTriangle, label: "Disputes", badge: "disputes" },
      { href: "/admin/moderation", icon: UserCheck, label: "Moderation" },
      { href: "/admin/account-recovery", icon: LifeBuoy, label: "Account Recovery", badge: "recovery" },

      { href: "/admin/payment-methods", icon: Globe, label: "Payment Methods" },
      { href: "/admin/kyc", icon: FileCheck, label: "KYC Verification", badge: "kyc" },
      { href: "/admin/notifications", icon: Bell, label: "Notifications" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/platform-controls", icon: Shield, label: "Platform Controls" },
      { href: "/admin/risk-controls", icon: AlertTriangle, label: "Risk Controls" },
      { href: "/admin/risk-center", icon: ShieldAlert, label: "Risk Center", badge: "risk" },
      { href: "/admin/security", icon: Shield, label: "Security & MFA" },
      { href: "/admin/settings", icon: Settings, label: "Settings" },
      { href: "/admin/logs", icon: Shield, label: "Audit Logs" },
      { href: "/admin/idempotency", icon: Lock, label: "Idempotency Logs" },
      { href: "/admin/dev-tools", icon: Beaker, label: "Dev Tools" },
      { href: "/admin/pwa", icon: Activity, label: "PWA Diagnostics" },
    ],
  },
];

const SidebarContent = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { counts } = useAdminPendingCounts();

  return (
    <>
      <div className="p-4 lg:p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Peerly</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 lg:p-4 space-y-4 lg:space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{item.label}</span>
                    {badgeCount(item.badge, counts) > 0 && (
                      <Badge
                        variant="destructive"
                        className="h-5 min-w-5 px-1.5 justify-center rounded-full text-[10px] font-semibold shrink-0"
                      >
                        {badgeCount(item.badge, counts) > 99 ? "99+" : badgeCount(item.badge, counts)}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 lg:p-4 border-t border-border space-y-2">
        <Link
          to="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all text-sm"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Back to App</span>
        </Link>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 mr-3 shrink-0" />
          Sign Out
        </Button>
      </div>
    </>
  );
};

// Mobile Sidebar with Sheet
export const MobileAdminSidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-card">
        <div className="flex flex-col h-full">
          <SidebarContent onClose={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Desktop Sidebar
export const AdminSidebar = () => {
  return (
    <aside className="hidden lg:flex w-64 h-screen sticky top-0 bg-card border-r border-border flex-col overflow-hidden">
      <SidebarContent />
    </aside>
  );
};
