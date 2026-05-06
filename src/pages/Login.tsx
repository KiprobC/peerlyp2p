import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import peerlyLogo from "@/assets/peerly-logo.png";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, mfaChallenge, completeMFAChallenge, cancelMFAChallenge, passkeyChallenge, completePasskeyChallenge, cancelPasskeyChallenge } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [attempts, setAttempts] = useState(0);

  // Get redirect destination from session storage
  const getRedirectPath = () => {
    const redirectPath = sessionStorage.getItem("redirectAfterLogin");
    if (redirectPath) {
      sessionStorage.removeItem("redirectAfterLogin");
      return redirectPath;
    }
    return "/dashboard";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error, mfaRequired, passkeyRequired } = await signIn(email, password);
    
    if (error) {
      toast.error(error.message || "Invalid email or password");
      setIsLoading(false);
      return;
    }

    if (mfaRequired || passkeyRequired) {
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back!");
    navigate(getRedirectPath());
    setIsLoading(false);
  };

  const handlePasskeyVerify = async () => {
    setIsLoading(true);
    const { error } = await completePasskeyChallenge();
    setIsLoading(false);
    if (error) {
      toast.error(error.message || "Passkey verification failed");
      return;
    }
    toast.success("Welcome back!");
    navigate(getRedirectPath());
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMfaError("");

    const { error } = await completeMFAChallenge(mfaCode);

    if (error) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        setMfaError("Too many attempts. Please try logging in again.");
        cancelMFAChallenge();
        setMfaCode("");
        setAttempts(0);
      } else {
        setMfaError(error.message || "Invalid verification code");
      }
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back!");
    navigate(getRedirectPath());
    setIsLoading(false);
  };

  const handleCancelMFA = () => {
    cancelMFAChallenge();
    setMfaCode("");
    setMfaError("");
    setAttempts(0);
  };

  // Show MFA challenge screen
  if (mfaChallenge) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Logo */}
            <Link to="/" className="flex items-center mb-8">
              <img src={peerlyLogo} alt="Peerly" className="h-8 w-auto" />
            </Link>

            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold">Two-Factor Authentication</h1>
              </div>
              <p className="text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <form onSubmit={handleMFASubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Verification Code</label>
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={mfaCode}
                  onChange={(e) => {
                    setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setMfaError("");
                  }}
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </div>

              {mfaError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {mfaError}
                </div>
              )}

              {attempts > 0 && attempts < 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  {5 - attempts} attempts remaining
                </p>
              )}

              <Button 
                variant="hero" 
                size="lg" 
                className="w-full" 
                disabled={isLoading || mfaCode.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify Code
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleCancelMFA}
              >
                Cancel and sign in with a different account
              </Button>
            </form>

            <div className="mt-6 p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground text-center">
                Open your authenticator app (Google Authenticator, Authy, etc.) and enter the current code.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Graphic */}
        <div className="hidden lg:flex flex-1 bg-card items-center justify-center p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 text-center">
            <div className="glass-card p-8 mb-8 premium-border">
              <div className="text-6xl mb-4">🔐</div>
              <h2 className="text-2xl font-bold mb-2">Secure Login</h2>
              <p className="text-muted-foreground">
                Your account is protected with two-factor authentication
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link to="/" className="flex items-center mb-8">
            <img src={peerlyLogo} alt="Peerly" className="h-8 w-auto" />
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
            <p className="text-muted-foreground">
              Sign in to access your account and start trading
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-border bg-secondary" />
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button variant="hero" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-muted-foreground">Don't have an account? </span>
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </div>
        </div>
      </div>

      {/* Right Side - Graphic */}
      <div className="hidden lg:flex flex-1 bg-card items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 text-center">
          <div className="glass-card p-8 mb-8 premium-border">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-2xl font-bold mb-2">Secure Trading</h2>
            <p className="text-muted-foreground">
              Your funds are protected by industry-leading security measures
            </p>
          </div>
          <div className="flex gap-4 justify-center">
            <div className="glass px-4 py-2 rounded-full text-sm premium-border">
              <span className="text-primary">✓</span> 2FA Protection
            </div>
            <div className="glass px-4 py-2 rounded-full text-sm premium-border">
              <span className="text-primary">✓</span> Escrow System
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;