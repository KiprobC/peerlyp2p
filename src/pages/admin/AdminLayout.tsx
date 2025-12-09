import { Outlet, Navigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAdminRole } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";

export const AdminLayout = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useAdminRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="glass-card text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access the admin panel.
          </p>
          <a href="/dashboard" className="text-primary hover:underline">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
