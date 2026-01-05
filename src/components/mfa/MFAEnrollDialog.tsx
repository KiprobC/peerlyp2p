import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMFA } from "@/hooks/useMFA";
import { Shield, Loader2, Copy, CheckCircle, Smartphone, Key, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface MFAEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const MFAEnrollDialog = ({ open, onOpenChange, onSuccess }: MFAEnrollDialogProps) => {
  const [step, setStep] = useState<"intro" | "qr" | "verify">("intro");
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  
  const { 
    enrollmentData, 
    enrolling, 
    verifying, 
    startEnrollment, 
    verifyEnrollment,
    cancelEnrollment,
    isLocked,
    lockedUntil,
    attempts,
  } = useMFA();

  const handleStart = async () => {
    const result = await startEnrollment();
    if (result.success) {
      setStep("qr");
    }
  };

  const handleVerify = async () => {
    if (!enrollmentData || verificationCode.length !== 6) return;
    
    const result = await verifyEnrollment(enrollmentData.id, verificationCode);
    
    // Only close dialog after MFA state has been refreshed and confirmed enabled
    if (result.success && result.isEnabled) {
      // Reset dialog state
      setStep("intro");
      setVerificationCode("");
      setCopiedSecret(false);
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const handleClose = async (isOpen: boolean) => {
    if (!isOpen) {
      if (step === "qr" || step === "verify") {
        await cancelEnrollment();
      }
      setStep("intro");
      setVerificationCode("");
      setCopiedSecret(false);
    }
    onOpenChange(isOpen);
  };

  const handleCopySecret = () => {
    if (enrollmentData?.totp.secret) {
      navigator.clipboard.writeText(enrollmentData.totp.secret);
      setCopiedSecret(true);
      toast.success("Secret copied to clipboard");
      setTimeout(() => setCopiedSecret(false), 3000);
    }
  };

  const getRemainingLockTime = () => {
    if (!lockedUntil) return "";
    const remainingMs = lockedUntil.getTime() - Date.now();
    const remainingMins = Math.ceil(remainingMs / 60000);
    return `${remainingMins} minute(s)`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Enable Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            {step === "intro" && "Add an extra layer of security to your account"}
            {step === "qr" && "Scan the QR code with your authenticator app"}
            {step === "verify" && "Enter the 6-digit code from your app"}
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Step 1: Get an Authenticator App</p>
                  <p className="text-sm text-muted-foreground">
                    Download Google Authenticator, Authy, or Microsoft Authenticator
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Step 2: Scan QR Code</p>
                  <p className="text-sm text-muted-foreground">
                    Use your app to scan the QR code we'll show you
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Step 3: Verify</p>
                  <p className="text-sm text-muted-foreground">
                    Enter the code from your app to complete setup
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Make sure to save your recovery codes. If you lose access to your authenticator,
                you'll need them to access your account.
              </p>
            </div>
          </div>
        )}

        {step === "qr" && enrollmentData && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg">
                <img 
                  src={enrollmentData.totp.qr_code} 
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Can't scan? Enter this code manually:
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-xs break-all font-mono">
                {enrollmentData.totp.secret}
              </code>
              <Button size="icon" variant="ghost" onClick={handleCopySecret}>
                {copiedSecret ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
                disabled={isLocked}
                autoComplete="one-time-code"
              />
              {attempts > 0 && attempts < 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  {5 - attempts} attempts remaining
                </p>
              )}
            </div>

            {isLocked && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">
                  Too many attempts. Try again in {getRemainingLockTime()}.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "intro" && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleStart} disabled={enrolling}>
                {enrolling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  "Get Started"
                )}
              </Button>
            </>
          )}

          {step === "qr" && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={() => setStep("verify")}>
                I've Scanned the Code
              </Button>
            </>
          )}

          {step === "verify" && (
            <>
              <Button variant="outline" onClick={() => setStep("qr")}>
                Back
              </Button>
              <Button 
                onClick={handleVerify} 
                disabled={verificationCode.length !== 6 || verifying || isLocked}
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Enable 2FA"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
