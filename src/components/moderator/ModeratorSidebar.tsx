import { Link, useLocation } from "react-router-dom";
import { 
  Shield,
  AlertTriangle,
  MessageSquare,
  FileText,
  ArrowLeft,
  LogOut,
  Menu,
  Scale
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { href: "/moderator", icon: Scale, label: "Dashboard" },
  { href: "/moderator/disputes", icon: AlertTriangle, label: "My Disputes" },
];

const SidebarContent = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <>
      <div className="p-4 lg:p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Moderator Panel</h1>
            <p className="text-xs text-muted-foreground">Dispute Resolution</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm",
                isActive
                  ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
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
export const MobileModeratorSidebar = () => {
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
export const ModeratorSidebar = () => {
  return (
    <aside className="hidden lg:flex w-64 min-h-screen bg-card border-r border-border flex-col">
      <SidebarContent />
    </aside>
  );
};
