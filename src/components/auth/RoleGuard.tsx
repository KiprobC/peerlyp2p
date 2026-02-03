import { Navigate } from "react-router-dom";
import { useRoles, AppRole } from "@/hooks/useRoles";
import { Loader2, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoleGuardProps {
  children: React.ReactNode;
  /** Required roles to access this route */
  allowedRoles: AppRole[];
  /** Where to redirect if access is denied (default: show access denied) */
  redirectTo?: string;
}

/**
 * Guards routes based on user roles.
 * Shows loading state while checking, then either renders children or shows access denied.
 */
export const RoleGuard = ({ children, allowedRoles, redirectTo }: RoleGuardProps) => {
  const { role, loading } = useRoles();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  const hasAccess = allowedRoles.includes(role);

  if (!hasAccess) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card text-center max-w-md w-full p-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            You don't have the required permissions to access this area.
            Please contact an administrator if you believe this is an error.
          </p>
          <Button onClick={() => window.history.back()} className="w-full">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RoleGuard;
