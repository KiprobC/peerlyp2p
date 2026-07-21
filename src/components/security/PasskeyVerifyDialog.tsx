import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { usePasskeyContext } from "@/contexts/PasskeyContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called once verification succeeds */
  onVerified: () => void;
  /** Optional fallback (e.g. email OTP) */
  onFallback?: () => void;
  title?: string;
  description?: string;
}

export const PasskeyVerifyDialog = ({
  open,
  onOpenChange,
  onVerified,
  onFallback,
  title = "Confirm with passkey",
  description = "Use fingerprint or face to continue",
}: Props) => {
  const { stepUpVerify } = usePasskeyContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async () => {
    setBusy(true);
    setError(null);
    const ok = await stepUpVerify();
    setBusy(false);
    if (ok) {
      onOpenChange(false);
      onVerified();
    } else {
      setError("Verification failed or cancelled");
    }
  };

  // Auto-trigger biometric prompt on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(verify, 200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            {busy ? (
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            ) : (
              <Fingerprint className="w-7 h-7 text-primary" />
            )}
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive text-center">{error}</div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {onFallback && (
            <Button variant="ghost" onClick={() => { onOpenChange(false); onFallback(); }} disabled={busy}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Use another method
            </Button>
          )}
          <Button onClick={verify} disabled={busy} className="flex-1">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Fingerprint className="w-4 h-4 mr-2" />}
            Try again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
