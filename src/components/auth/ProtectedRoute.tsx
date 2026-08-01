import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FullScreenLoader } from "@/components/loaders";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protects routes that require a fully authenticated state.
 * Pending second-factor states are treated as NOT authenticated.
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { authState } = useAuth();
  const location = useLocation();

  if (authState === "loading") {
    return <FullScreenLoader text="Verifying session..." />;
  }

  if (authState !== "authenticated") {
    sessionStorage.setItem("redirectAfterLogin", location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
