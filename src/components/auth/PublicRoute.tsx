import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface PublicRouteProps {
  children: React.ReactNode;
  /** If true, authenticated users will be redirected to dashboard */
  redirectAuthenticated?: boolean;
}

/**
 * Handles public routes with optional redirect for authenticated users.
 * Used for marketing pages and auth pages (login/signup).
 */
export const PublicRoute = ({ children, redirectAuthenticated = false }: PublicRouteProps) => {
  const { authState } = useAuth();

  // Show loading state while auth is being resolved
  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect authenticated users away from public-only pages (like login/signup)
  if (redirectAuthenticated && authState === "authenticated") {
    // Check for stored redirect destination
    const redirectPath = sessionStorage.getItem("redirectAfterLogin");
    if (redirectPath) {
      sessionStorage.removeItem("redirectAfterLogin");
      return <Navigate to={redirectPath} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
