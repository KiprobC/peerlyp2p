import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, Check, Download, Printer, Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { downloadRecoveryCodes, printRecoveryCodes } from "@/lib/recoveryCodes";

interface RecoveryCodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plaintext codes — available only at generation time. */
  codes: string[] | null;
  generating?: boolean;
  onDone?: () => void;
}

export const RecoveryCodesDialog = ({
  open,
  onOpenChange,
  codes,
  generating = false,
  onDone,
}: RecoveryCodesDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) {
      setCopied(false);
      setAcknowledged(false);
    }
  }, [open]);

  const handleCopy = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Recovery codes copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handlePrint = () => {
    if (!codes) return;
    if (!printRecoveryCodes(codes)) toast.error("Allow pop-ups to print your codes");
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : undefined)}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Your recovery codes
          </DialogTitle>
          <DialogDescription>
            Save these now. They are the only way back into your account if you lose your
            authenticator.
          </DialogDescription>
        </DialogHeader>

        {generating || !codes ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/40 p-4">
              {codes.map((code) => (
                <span
                  key={code}
                  className="font-mono text-sm tracking-widest text-foreground text-center py-1"
                >
                  {code}
                </span>
              ))}
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">Each recovery code can only be used once.</p>
                <p className="text-destructive/80">
                  Using one code invalidates every remaining code and issues a fresh set. These
                  codes will never be shown again.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadRecoveryCodes(codes)}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              <span className="text-muted-foreground">
                I have saved my recovery codes somewhere safe.
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button
            className="w-full"
            disabled={!acknowledged || generating || !codes}
            onClick={() => {
              onOpenChange(false);
              onDone?.();
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecoveryCodesDialog;
