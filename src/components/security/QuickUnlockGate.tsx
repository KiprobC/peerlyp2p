import { useEffect, useRef, useState } from "react";
import { Fingerprint, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useQuickUnlock,
  markUnlocked,
  reconcileQuickUnlockWithPasskeys,
import { usePasskeysContext } from "@/contexts/PasskeyContext";
import { toast } from "sonner";

/**
 * Full-screen unlock overlay. Renders only when:
 *   - user is authenticated
 *   - Quick Unlock is enabled in settings
 *   - the user actually has at least one registered passkey
 *   - policy (require on open / idle timeout) says a fresh proof is needed
 *
 * Startup recovery: if Quick Unlock was enabled but no passkey exists, we
 * silently disable it (and Require Unlock On App Open) so the user is never
 * locked out.
 */
export const QuickUnlockGate = ({ children }: { children: React.ReactNode }) => {
  const { authState, user, signOut } = useAuth();
  const { needsUnlock, settings, evaluate } = useQuickUnlock();
  const { passkeys, stepUpVerify, loading: passkeysLoading } = usePasskeysContext();
  const [verifying, setVerifying] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const reconciledRef = useRef(false);

  const hasPasskey = passkeys.length > 0;

  // Startup recovery: disable Quick Unlock if the account has no passkey.
  useEffect(() => {
    if (
      authState === "authenticated" &&
      !passkeysLoading &&
      !reconciledRef.current
    ) {
      reconciledRef.current = true;
      const wasReset = reconcileQuickUnlockWithPasskeys(passkeys.length);
      if (wasReset) {
        toast.warning("Quick Unlock was disabled because no passkey is registered.");
        // eslint-disable-next-line no-console
        console.info("[quick-unlock] recovery", {
          user_id: user?.id,
          username: user?.email,
          passkey_count: passkeys.length,
          quick_unlock_enabled: false,
          require_unlock_enabled: false,
        });
        evaluate();
      }
    }
  }, [authState, passkeysLoading, passkeys.length, user?.id, user?.email, evaluate]);

  const shouldGate =
    authState === "authenticated" &&
    settings.enabled &&
    needsUnlock &&
    !passkeysLoading &&
    hasPasskey;

  const runUnlock = async () => {
    if (verifying) return;
    setVerifying(true);
    setLastError(null);
    try {
      const ok = await stepUpVerify();
      if (ok) {
        markUnlocked();
        evaluate();
      } else {
        setLastError("Verification cancelled or failed. Please try again.");
      }
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "NotAllowedError") setLastError("Verification cancelled.");
      else if (name === "SecurityError") setLastError("Passkey not found on this device.");
      else if (name === "NotSupportedError") setLastError("This device does not support passkeys.");
      else setLastError(e?.message || "Authentication failed.");
    } finally {
      setVerifying(false);
    }
  };

  // Auto-prompt once when the gate first appears (nice UX on PWA open).
  useEffect(() => {
    if (shouldGate && !autoTried) {
      setAutoTried(true);
      void runUnlock();
    }
    if (!shouldGate) setAutoTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldGate]);

  if (!shouldGate) return <>{children}</>;

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

        <Button
          size="lg"
          className="w-full h-14 text-base"
          onClick={runUnlock}
          disabled={verifying}
        >
          <Fingerprint className="w-5 h-5 mr-2" />
          {verifying ? "Verifying…" : "Unlock with biometrics"}
        </Button>

        {lastError && !verifying && (
          <p className="text-xs text-destructive">{lastError}</p>
        )}

        <button
          className="text-xs text-muted-foreground underline"
          onClick={async () => {
            await signOut();
            toast.info("Please sign in again");
          }}
        >
          <LogOut className="w-3 h-3 inline mr-1" />
          Use a different account
        </button>
      </div>
    </div>
  );
};

export default QuickUnlockGate;
