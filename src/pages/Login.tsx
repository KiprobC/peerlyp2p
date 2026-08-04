import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield, Loader2, AlertCircle, Fingerprint, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import peerlyLogo from "@/assets/peerly-logo.png";
import { OTPVerificationDialog } from "@/components/security/OTPVerificationDialog";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const Login = () => {
  const navigate = useNavigate();
  const { signIn, mfaChallenge, completeMFAChallenge, cancelMFAChallenge, passkeyChallenge, completePasskeyChallenge, cancelPasskeyChallenge, acceptPasskeyFallback, redeemRecoveryCode } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [mfaCode, setMfaCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [passkeyError, setPasskeyError] = useState("");
  const [showOtpFallback, setShowOtpFallback] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [showMfa, setShowMfa] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

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

    const { error, mfaRequired, passkeyRequired } = await signIn(email, password, rememberMe);


    if (error) {
      toast.error(error.message || "Invalid email or password");
      setIsLoading(false);
      return;
    }

    if (mfaRequired) {
      setShowMfa(true);
      setIsLoading(false);
      return;
    }
 
    if (passkeyRequired) {
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back!");
    navigate(getRedirectPath());
    setIsLoading(false);
  };

  const handlePasskeyVerify = async () => {
    setIsLoading(true);
    setPasskeyError("");
    const { error } = await completePasskeyChallenge();
    setIsLoading(false);
    if (error) {
      setPasskeyError(error.message || "Passkey verification failed or was cancelled");
      return;
    }
    toast.success("Welcome back!");
    navigate(getRedirectPath());
  };

  useEffect(() => {
    if (passkeyChallenge && !autoTriggered) {
      setAutoTriggered(true);
      handlePasskeyVerify();
    }
    if (!passkeyChallenge) {
      setAutoTriggered(false);
      setPasskeyError("");
      setShowOtpFallback(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passkeyChallenge]);

  const handleOtpFallbackVerified = () => {
    // Email OTP verified — accept session and proceed without signing out
    setShowOtpFallback(false);
    acceptPasskeyFallback();
    toast.success("Verified by email — welcome back!");
    navigate(getRedirectPath());
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMfaError("");

    const { error } = await completeMFAChallenge(
      mfaCode,
      trustDevice
    );

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
    setShowMfa(false);
    navigate(getRedirectPath());
    setIsLoading(false);
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMfaError("");

    const { error } = await redeemRecoveryCode(recoveryCode);
    setIsLoading(false);

    if (error) {
      setMfaError(error.message || "Invalid recovery code");
      return;
    }

    setRecoveryCode("");
    setUseRecoveryCode(false);
    setShowMfa(false);
    toast.success("Two-factor authentication reset. Set up a new authenticator in Settings.");
    navigate("/settings");
  };

  const handleCancelMFA = () => {
    setShowMfa(false);
    cancelMFAChallenge();
    setMfaCode("");
    setRecoveryCode("");
    setUseRecoveryCode(false);
    setMfaError("");
    setAttempts(0);
  };

  // Show passkey challenge screen
  if (passkeyChallenge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <Link to="/" className="flex items-center justify-center mb-8">
            <img src={peerlyLogo} alt="Peerly" className="h-8 w-auto" />
          </Link>
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            {isLoading ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <Fingerprint className="w-10 h-10 text-primary" />
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">Use your passkey to sign in</h1>
          <p className="text-muted-foreground mb-8">
            Use fingerprint, face, or device PIN to continue
          </p>
          {passkeyError && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              {passkeyError}
            </div>
          )}
          <div className="space-y-3">
            <Button onClick={handlePasskeyVerify} className="w-full" size="lg" disabled={isLoading}>
              <Fingerprint className="w-5 h-5 mr-2" />
              Try passkey again
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => setShowOtpFallback(true)}
              disabled={isLoading}
            >
              <Mail className="w-5 h-5 mr-2" />
              Use email code instead
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { cancelPasskeyChallenge(); }}>
              Cancel and use a different account
            </Button>
          </div>
        </div>

        <OTPVerificationDialog
          open={showOtpFallback}
          onOpenChange={setShowOtpFallback}
          onVerified={handleOtpFallbackVerified}
          actionType="sensitive_action"
          title="Verify with email code"
          description="We'll send a verification code to your email as a passkey backup"
          actionLabel="Verify & Sign In"
        />
      </div>
    );
  }

  // Show MFA challenge screen
  if (showMfa) {
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
                <h1 className="text-3xl font-bold">
                  {useRecoveryCode ? "Use a recovery code" : "Two-Factor Authentication"}
                </h1>
              </div>
              <p className="text-muted-foreground">
                {useRecoveryCode
                  ? "Enter one of the recovery codes you saved when you enabled two-factor authentication"
                  : "Enter the 6-digit code from your authenticator app"}
              </p>
            </div>

            {useRecoveryCode ? (
              <form onSubmit={handleRecoverySubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">Recovery Code</label>
                  <Input
                    type="text"
                    placeholder="XXXX-XXXX"
                    value={recoveryCode}
                    onChange={(e) => {
                      setRecoveryCode(e.target.value.toUpperCase().slice(0, 9));
                      setMfaError("");
                    }}
                    className="text-center text-2xl tracking-widest font-mono uppercase"
                    maxLength={9}
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

                <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                  Using a recovery code turns off two-factor authentication, invalidates every
                  remaining code, and asks you to set up a new authenticator.
                </div>

                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={isLoading || recoveryCode.length < 8}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Use recovery code
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setUseRecoveryCode(false);
                    setMfaError("");
                  }}
                >
                  Back to authenticator code
                </Button>
              </form>
            ) : (
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

                <div className="flex items-center space-x-2">
                  <input
                    id="trust-device"
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                  />
                  <label
                    htmlFor="trust-device"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Trust this device for 7 days
                  </label>
                </div>

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
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setUseRecoveryCode(true);
                    setMfaError("");
                  }}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  Lost your phone? Use a recovery code
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
            )}

            <div className="mt-6 text-center">
              <Link to="/account-recovery" className="text-sm text-primary hover:underline">
                Can't sign in?
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
                <input
                  type="checkbox"
                  className="rounded border-border bg-secondary"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-sm text-muted-foreground">Keep me signed in</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            {!rememberMe && (
              <p className="text-xs text-muted-foreground -mt-2">
                You'll be signed out when you close your browser.
              </p>
            )}

            <Button variant="hero" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
              <ArrowRight className="w-5 h-5" />
            </Button>

            <div className="text-center">
              <Link to="/account-recovery" className="text-sm text-primary hover:underline">
                Can't sign in?
              </Link>
            </div>
          </form>


          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <GoogleSignInButton source="login" />

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