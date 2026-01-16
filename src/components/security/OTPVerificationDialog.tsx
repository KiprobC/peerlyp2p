import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOTPVerification, OTPActionType } from "@/hooks/useOTPVerification";
import { useMFA } from "@/hooks/useMFA";
import { Shield, Mail, Loader2, RefreshCw, AlertTriangle, CheckCircle, Lock } from "lucide-react";

interface OTPVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  onCancel?: () => void;
  actionType: OTPActionType;
  title?: string;
  description?: string;
  actionLabel?: string;
  requireMFA?: boolean; // If true, requires both OTP and MFA
}

export const OTPVerificationDialog = ({
  open,
  onOpenChange,
  onVerified,
  onCancel,
  actionType,
  title = "Verify Your Identity",
  description = "Enter the verification code sent to your email",
  actionLabel = "Verify",
  requireMFA = false,
}: OTPVerificationDialogProps) => {
  const [code, setCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [step, setStep] = useState<"otp" | "mfa">("otp");
  const [countdown, setCountdown] = useState(0);

  const {
    loading: otpLoading,
    codeSent,
    verified: otpVerified,
    error: otpError,
    attemptsRemaining,
    lockedUntil,
    cooldownUntil,
    isLocked,
    isOnCooldown,
    requestCode,
    verifyCode,
    resendCode,
    reset: resetOTP,
    devCode,
  } = useOTPVerification();

  const {
    isEnabled: mfaEnabled,
    challengeAndVerify,
    loading: mfaLoading,
    isLocked: mfaLocked,
    lockedUntil: mfaLockedUntil,
  } = useMFA();

  // Request OTP when dialog opens
  useEffect(() => {
    if (open && !codeSent && !otpLoading) {
      requestCode(actionType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actionType]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCode("");
      setMfaCode("");
      setStep("otp");
      resetOTP();
    }
  }, [open, resetOTP]);

  // Countdown timer for cooldown
  useEffect(() => {
    if (!cooldownUntil) {
      setCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil.getTime() - Date.now()) / 1000));
      setCountdown(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const handleVerifyOTP = async () => {
    const success = await verifyCode(code, actionType);
    
    if (success) {
      // Check if MFA is also required - verify mfaEnabled is truly enabled
      // by re-checking with fresh data
      if (requireMFA && mfaEnabled) {
        // Double-check MFA is actually enabled before requiring it
        const { data: factors } = await import("@/integrations/supabase/client").then(m => 
          m.supabase.auth.mfa.listFactors()
        );
        const hasVerifiedFactor = factors?.totp.some(f => f.status === "verified");
        
        if (hasVerifiedFactor) {
          setStep("mfa");
        } else {
          // MFA not actually enabled, proceed without it
          onVerified();
          onOpenChange(false);
        }
      } else {
        onVerified();
        onOpenChange(false);
      }
    }
  };

  const handleVerifyMFA = async () => {
    const result = await challengeAndVerify(mfaCode);
    
    if (result.success) {
      onVerified();
      onOpenChange(false);
    }
  };

  const handleResend = async () => {
    setCode("");
    await resendCode(actionType);
  };

  const handleClose = (open: boolean) => {
    if (!open && onCancel) {
      onCancel();
    }
    onOpenChange(open);
  };

  const getRemainingLockTime = () => {
    const lockTime = isLocked ? lockedUntil : mfaLockedUntil;
    if (!lockTime) return null;
    const remaining = Math.ceil((lockTime.getTime() - Date.now()) / 60000);
    return remaining > 0 ? remaining : null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (step === "otp" && code.length === 6 && !otpLoading) {
        handleVerifyOTP();
      } else if (step === "mfa" && mfaCode.length === 6 && !mfaLoading) {
        handleVerifyMFA();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "otp" ? (
              <Mail className="h-5 w-5 text-primary" />
            ) : (
              <Shield className="h-5 w-5 text-primary" />
            )}
            {step === "otp" ? title : "Two-Factor Authentication"}
          </DialogTitle>
          <DialogDescription>
            {step === "otp" 
              ? description
              : "Enter the code from your authenticator app"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* OTP Step */}
          {step === "otp" && (
            <>
              {/* Code sent indicator */}
              {codeSent && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">
                    Verification code sent to your email
                  </span>
                </div>
              )}

              {/* Dev code display (development only) */}
              {devCode && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-yellow-600 dark:text-yellow-400 font-mono">
                    Dev code: {devCode}
                  </span>
                </div>
              )}

              {/* Locked state */}
              {isLocked && getRemainingLockTime() && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Lock className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    Too many attempts. Try again in {getRemainingLockTime()} minute(s).
                  </span>
                </div>
              )}

              {/* Code input */}
              <div className="space-y-2">
                <Label htmlFor="otp-code">Verification Code</Label>
                <Input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 6-digit code"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  disabled={isLocked || otpLoading}
                  autoFocus
                />
              </div>

              {/* Error display */}
              {otpError && !isLocked && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {otpError}
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <span className="text-muted-foreground">
                      ({attemptsRemaining} attempts left)
                    </span>
                  )}
                </p>
              )}

              {/* Resend button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  disabled={isOnCooldown || otpLoading}
                  className="text-muted-foreground"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${otpLoading ? "animate-spin" : ""}`} />
                  {isOnCooldown && countdown > 0
                    ? `Resend in ${countdown}s`
                    : "Resend Code"
                  }
                </Button>
              </div>
            </>
          )}

          {/* MFA Step */}
          {step === "mfa" && (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  Email verified. Now enter your authenticator code.
                </span>
              </div>

              {/* MFA Locked state */}
              {mfaLocked && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <Lock className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    Too many attempts. Try again in {getRemainingLockTime()} minute(s).
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="mfa-code">Authenticator Code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter 6-digit code"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  disabled={mfaLocked || mfaLoading}
                  autoFocus
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          {step === "otp" ? (
            <Button
              onClick={handleVerifyOTP}
              disabled={code.length !== 6 || isLocked || otpLoading}
            >
              {otpLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {requireMFA && mfaEnabled ? "Continue" : actionLabel}
            </Button>
          ) : (
            <Button
              onClick={handleVerifyMFA}
              disabled={mfaCode.length !== 6 || mfaLocked || mfaLoading}
            >
              {mfaLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};