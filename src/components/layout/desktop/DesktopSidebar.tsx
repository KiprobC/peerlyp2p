import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight, Bell, CircleHelp, LayoutDashboard, MessageCircle,
  Settings, Store, User, Wallet, X, Receipt,
} from "lucide-react";
import peerlyIcon from "@/assets/peerly-icon.png";
import peerlyLogo from "@/assets/peerly-icon.png";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import SupportChatDialog from "@/components/support/SupportChatDialog";

/**
 * Shared Facebook-style persistent left navigation used by every desktop
 * (md+) page shell. Fixed width so pages can offset with md:ml-60.
 */
export const DESKTOP_SIDEBAR_WIDTH_CLASS = "md:ml-60";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Marketplace", icon: Store, to: "/marketplace" },
  { label: "Trades", icon: Receipt, to: "/trades" },
  { label: "Wallet", icon: Wallet, to: "/wallet/deposit" },
  { label: "My Offers", icon: Store, to: "/my-offers" },
];

const FOOTER_ITEMS = [
  { label: "Notifications", icon: Bell, to: "/notifications" },
  { label: "Settings", icon: Settings, to: "/settings" },
  { label: "Profile", icon: User, to: "/profile" },
  { label: "Help & FAQ", icon: CircleHelp, to: "/how-it-works" },
];

const isActivePath = (item: { to: string }, pathname: string) => {
  if (item.to === "/dashboard") return pathname === "/dashboard";
  if (item.to === "/marketplace") return pathname.startsWith("/marketplace") || pathname.startsWith("/create-offer");
  if (item.to === "/trades") return pathname.startsWith("/trade");
  if (item.to === "/wallet/deposit") return pathname.startsWith("/wallet");
  return pathname === item.to || pathname.startsWith(item.to);
};

export const DesktopSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const [supportOpen, setSupportOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border/70 bg-card/95 backdrop-blur-xl md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-border/60 px-4">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
          <img src={peerlyIcon} alt="Peerly" className="h-8 w-8 rounded-lg" />
          <span className="text-sm font-bold tracking-[0.18em] text-foreground">PEERLY</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(item, location.pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setSupportOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MessageCircle className="h-5 w-5 shrink-0" />
          <span>Messages</span>
        </button>
      </nav>

      <div className="space-y-1 border-t border-border/60 px-3 py-4">
        {FOOTER_ITEMS.map((item) => {
          const active = item.to === "/notifications" && location.pathname === "/notifications";
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <span className="relative shrink-0">
                <item.icon className="h-5 w-5" />
                {item.to === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.to === "/notifications" && unreadCount > 0 && (
                <span className="rounded-full bg-destructive/15 px-1.5 text-[10px] font-semibold text-destructive">{unreadCount}</span>
              )}
            </Link>
          );
        })}
        <button
          onClick={handleSignOut}
          disabled={!user}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          <X className="h-5 w-5 shrink-0" />
          <span>Sign out</span>
        </button>
        <p className="flex items-center gap-1.5 px-3 pt-2 text-[10px] text-muted-foreground/70">
          <ArrowRight className="h-3 w-3" /> Escrow-protected P2P trading
        </p>
      </div>

      <SupportChatDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </aside>
  );
};

export default DesktopSidebar;
