import { Link, useLocation } from "react-router-dom";
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
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navSections = [
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
      { href: "/admin/offers", icon: Package, label: "Offers" },
      { href: "/admin/trades", icon: ArrowRightLeft, label: "Trades" },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/admin/wallets", icon: Wallet, label: "Wallets" },
      { href: "/admin/transactions", icon: Receipt, label: "Transactions" },
    ],
  },
  {
    title: "Support",
    items: [
      { href: "/admin/disputes", icon: AlertTriangle, label: "Disputes" },
      { href: "/admin/notifications", icon: Bell, label: "Notifications" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/settings", icon: Settings, label: "Settings" },
      { href: "/admin/logs", icon: Shield, label: "Security Logs" },
    ],
  },
];

export const AdminSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Kenya Coin Connect</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
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
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to App</span>
        </Link>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};
