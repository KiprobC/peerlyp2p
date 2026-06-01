import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";

interface GoogleSignInButtonProps {
  /** Analytics label: "login" or "signup" */
  source: "login" | "signup";
  label?: string;
  className?: string;
}

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.15.8 3.87 1.49l2.64-2.55C16.84 3.43 14.66 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12s4.26 9.5 9.5 9.5c5.48 0 9.11-3.85 9.11-9.27 0-.62-.07-1.1-.16-1.53H12z"
    />
    <path
      fill="#34A853"
      d="M3.88 7.34l3.2 2.35C7.94 7.7 9.8 6.4 12 6.4c1.88 0 3.15.8 3.87 1.49l2.64-2.55C16.84 3.43 14.66 2.5 12 2.5 8.24 2.5 4.99 4.66 3.88 7.34z"
      opacity=".0"
    />
    <path
      fill="#4285F4"
      d="M21.45 12.23c0-.62-.07-1.1-.16-1.53H12v3.9h5.5c-.11.62-.7 1.83-2 2.66l3.16 2.45c1.85-1.7 2.79-4.21 2.79-7.48z"
    />
    <path
      fill="#FBBC05"
      d="M6.06 14.16A6.05 6.05 0 015.7 12c0-.76.13-1.49.34-2.16L2.83 7.43A9.49 9.49 0 002.5 12c0 1.53.37 2.97 1.02 4.24l2.54-2.08z"
    />
    <path
      fill="#34A853"
      d="M12 21.5c2.66 0 4.89-.88 6.52-2.39l-3.16-2.45c-.86.6-2.02 1.02-3.36 1.02-2.58 0-4.77-1.7-5.55-4.05L3.33 16.4C4.99 19.41 8.24 21.5 12 21.5z"
    />
    <path fill="none" d="M0 0h24v24H0z" />
  </svg>
);

export const GoogleSignInButton = ({ source, label, className }: GoogleSignInButtonProps) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleClick = async () => {
    setLoading(true);
    try {
      // Analytics: track source (login vs signup)
      try {
        sessionStorage.setItem("oauth_source", source);
      } catch {
        /* ignore */
      }

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setLoading(false);
        return;
      }

      if (result.redirected) {
        // Browser will redirect to Google — keep loading state until it does
        return;
      }

      // Tokens already set — session is established
      toast.success(source === "signup" ? "Account created!" : "Welcome back!");
      navigate("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Google sign-in failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={`w-full bg-background hover:bg-muted/60 border-border ${className ?? ""}`}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : (
        <GoogleIcon className="w-5 h-5 mr-2" />
      )}
      {label ?? "Continue with Google"}
    </Button>
  );
};

export default GoogleSignInButton;
