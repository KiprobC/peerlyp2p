import { Link, useLocation } from "react-router-dom";
import { Home, Store, ArrowRightLeft, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { path: "/dashboard", icon: Home, label: "Home" },
  { path: "/marketplace", icon: Store, label: "Market" },
  { path: "/trades", icon: ArrowRightLeft, label: "Trades" },
  { path: "/profile", icon: User, label: "Profile" },
];

export const MobileBottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Don't show if not logged in
  if (!user) return null;

  // Don't show on admin pages
  if (location.pathname.startsWith("/admin")) return null;

  // Don't show on auth pages
  if (["/login", "/signup", "/"].includes(location.pathname)) return null;

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "relative p-1.5 rounded-full transition-colors",
                active && "bg-primary/10"
              )}>
                <item.icon className={cn(
                  "w-5 h-5",
                  active && "text-primary"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium",
                active && "text-primary"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
