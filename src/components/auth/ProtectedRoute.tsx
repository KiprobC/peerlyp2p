import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AuthState } from "@/contexts/AuthContext";
import { FullScreenLoader } from "@/components/loaders";

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
    return <FullScreenLoader text="Verifying session..." />;
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
