import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AuthState } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protects routes that require authentication.
 * Redirects unauthenticated users to login while preserving intended destination.
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { authState } = useAuth();
  const location = useLocation();

  // Show loading state while auth is being resolved
  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (authState === "unauthenticated") {
    // Store the intended destination for redirect after login
    sessionStorage.setItem("redirectAfterLogin", location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
