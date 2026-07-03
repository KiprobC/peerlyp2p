import { useEffect, useState } from "react";
import { Fingerprint, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuickUnlock, markUnlocked } from "@/hooks/useQuickUnlock";
import { usePasskeys } from "@/hooks/usePasskeys";
import { toast } from "sonner";

/**
 * Full-screen unlock overlay. Renders only when:
 *   - user is authenticated
 *   - Quick Unlock is enabled in settings
 *   - policy (require on open / idle timeout) says a fresh proof is needed
 *
 * Uses existing WebAuthn passkey step-up (Face ID / Touch ID / Windows Hello /
 * Android biometrics / device PIN — whatever the platform authenticator offers).
 * signCount / origin / RPID validation is enforced server-side by
 * passkey-auth-finish, so all normal passkey security checks still apply.
 */
export const QuickUnlockGate = ({ children }: { children: React.ReactNode }) => {
  const { authState, user, signOut } = useAuth();
  const { needsUnlock, settings, evaluate } = useQuickUnlock();
  const { passkeys, stepUpVerify, loading: passkeysLoading } = usePasskeys();
  const [verifying, setVerifying] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  const shouldGate =
    authState === "authenticated" && settings.enabled && needsUnlock;

  const runUnlock = async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      const ok = await stepUpVerify();
      if (ok) {
        markUnlocked();
        evaluate();
      }
    } finally {
      setVerifying(false);
    }
  };

  // Auto-prompt once when the gate first appears (nice UX on PWA open).
  useEffect(() => {
    if (shouldGate && !autoTried && !passkeysLoading && passkeys.length > 0) {
      setAutoTried(true);
      void runUnlock();
    }
    if (!shouldGate) setAutoTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldGate, passkeysLoading, passkeys.length]);

  if (!shouldGate) return <>{children}</>;

  const hasPasskey = passkeys.length > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full px-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Peerly Locked</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.email
              ? `Unlock to continue as ${user.email}`
              : "Verify it's you to continue"}
          </p>
        </div>

        {hasPasskey ? (
          <Button
            size="lg"
            className="w-full h-14 text-base"
            onClick={runUnlock}
            disabled={verifying}
          >
            <Fingerprint className="w-5 h-5 mr-2" />
            {verifying ? "Verifying…" : "Unlock with biometrics"}
          </Button>
        ) : (
          <div className="w-full space-y-3">
            <p className="text-sm text-destructive">
              No passkey is registered on this device. Sign in again to continue.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await signOut();
                toast.info("Please sign in again");
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out and log in
            </Button>
          </div>
        )}

        {hasPasskey && (
          <button
            className="text-xs text-muted-foreground underline"
            onClick={async () => {
              await signOut();
            }}
          >
            Use a different account
          </button>
        )}
      </div>
    </div>
  );
};

export default QuickUnlockGate;
