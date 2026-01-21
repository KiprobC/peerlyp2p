import { useEffect, useState } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { AdminSidebar, MobileAdminSidebar } from "@/components/admin/AdminSidebar";
import { ModeratorNotificationBell } from "@/components/moderator/ModeratorNotificationBell";
import { useAdminRole } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export const AdminLayout = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Session timeout handling
  useEffect(() => {
    const handleActivity = () => setLastActivity(Date.now());

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    const checkTimeout = setInterval(() => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT) {
        signOut();
        navigate("/login");
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      clearInterval(checkTimeout);
    };
  }, [lastActivity, signOut, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            You don't have administrator privileges to access this panel. Please contact system support if you believe this is an error.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 overflow-auto w-full">
        {/* Mobile Header */}
        <header className="sticky top-0 z-40 lg:hidden bg-card/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MobileAdminSidebar />
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold">Admin Panel</span>
              </div>
            </div>
            <ModeratorNotificationBell />
          </div>
        </header>
        
        {/* Desktop Header with Notification Bell */}
        <header className="hidden lg:flex sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-3 justify-end">
          <ModeratorNotificationBell />
        </header>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
