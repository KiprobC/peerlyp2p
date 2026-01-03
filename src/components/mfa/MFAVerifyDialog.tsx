import { useState, useEffect } from "react";
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
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { useMFA } from "@/hooks/useMFA";
import { toast } from "sonner";

interface MFAVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export const MFAVerifyDialog = ({
  open,
  onOpenChange,
  onVerified,
  onCancel,
  title = "Two-Factor Authentication",
  description = "Enter the 6-digit code from your authenticator app",
  actionLabel = "Verify",
}: MFAVerifyDialogProps) => {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  
  const { challengeAndVerify, isLocked, lockedUntil, attempts } = useMFA();

  useEffect(() => {
    if (open) {
      setCode("");
      setError("");
    }
  }, [open]);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    
    setVerifying(true);
    setError("");

    const result = await challengeAndVerify(code);

    if (result.success) {
      toast.success("Verification successful");
      onOpenChange(false);
      onVerified();
    } else {
      setError(result.error || "Invalid verification code");
    }

    setVerifying(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && onCancel) {
      onCancel();
    }
    onOpenChange(isOpen);
  };

  const getRemainingLockTime = () => {
    if (!lockedUntil) return "";
    const remainingMs = lockedUntil.getTime() - Date.now();
    const remainingMins = Math.ceil(remainingMs / 60000);
    return `${remainingMins} minute(s)`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6 && !verifying && !isLocked) {
      handleVerify();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification Code</Label>
            <Input
              id="mfa-code"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              onKeyDown={handleKeyDown}
              className="text-center text-2xl tracking-widest font-mono"
              maxLength={6}
              disabled={isLocked || verifying}
              autoComplete="one-time-code"
              autoFocus
            />
          </div>

          {error && !isLocked && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {attempts > 0 && attempts < 5 && !isLocked && (
            <p className="text-xs text-muted-foreground text-center">
              {5 - attempts} attempts remaining
            </p>
          )}

          {isLocked && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">
                Too many attempts. Try again in {getRemainingLockTime()}.
              </p>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            Open your authenticator app and enter the current code
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleVerify}
            disabled={code.length !== 6 || verifying || isLocked}
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
