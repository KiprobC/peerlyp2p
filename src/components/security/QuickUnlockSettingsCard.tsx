import { useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuickUnlock } from "@/hooks/useQuickUnlock";
import { usePasskeys } from "@/hooks/usePasskeys";
import { PasskeySetupDialog } from "@/components/security/PasskeySetupDialog";

export const QuickUnlockSettingsCard = () => {
  const { settings, updateSettings } = useQuickUnlock();
  const { passkeys, loading } = usePasskeys();
   useEffect(() => {
    console.log("QuickUnlock passkeys:", passkeys);
    console.log("Loading:", loading);
    console.log("Has passkey:", passkeys.length);
   }, [passkeys, loading]);
  const hasPasskey = !loading && passkeys.length > 0;
   console.log("===== QUICK UNLOCK =====");
   console.log(passkeys);
   console.log(passkeys.length);
   console.log(hasPasskey);

  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [enableAfterRegister, setEnableAfterRegister] = useState(false);

  // Auto-enable Quick Unlock after a passkey is registered from this card.
  useEffect(() => {
    if (enableAfterRegister && hasPasskey) {
      updateSettings({ enabled: true });
      setEnableAfterRegister(false);
    }
  }, [enableAfterRegister, hasPasskey, updateSettings]);

  // Safety net: if settings say enabled but no passkey exists, keep them off.
const checkedRef = useRef(false);

useEffect(() => {
  if (loading || checkedRef.current) return;

  checkedRef.current = true;

  if (!hasPasskey && (settings.enabled || settings.requireOnOpen)) {
    updateSettings({
      enabled: false,
      requireOnOpen: false,
    });
  }
}, [
  loading,
  hasPasskey,
  settings.enabled,
  settings.requireOnOpen,
  updateSettings,
]);

  const handleEnableToggle = (v: boolean) => {
    if (v && !hasPasskey) {
      setShowRegisterPrompt(true);
      return;
    }
    updateSettings({ enabled: v });
  };

  const canRequireOnOpen = settings.enabled && hasPasskey;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Fingerprint className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium">Quick Unlock</p>
          <p className="text-xs text-muted-foreground">
            Use Face ID, fingerprint, Windows Hello or device PIN to re-open the app
          </p>
        </div>
      </div>

      {!loading && !hasPasskey && (
      <p className="text-xs text-amber-500">
       Quick Unlock requires a registered passkey.
      </p>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="qu-enable" className="text-sm">Enable Quick Unlock</Label>
        <Switch
          id="qu-enable"
          checked={settings.enabled}
          onCheckedChange={handleEnableToggle}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="qu-open" className="text-sm">Require unlock on app open</Label>
          <Switch
            id="qu-open"
            checked={canRequireOnOpen && settings.requireOnOpen}
            disabled={!canRequireOnOpen}
            onCheckedChange={(v) => updateSettings({ requireOnOpen: v })}
          />
        </div>
        {!canRequireOnOpen && (
          <p className="text-[11px] text-muted-foreground">
            Requires Quick Unlock and a registered passkey.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm">Auto-lock after idle</Label>
        <Select
          value={String(settings.idleMinutes)}
          disabled={!settings.enabled}
          onValueChange={(v) => updateSettings({ idleMinutes: Number(v) })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Never</SelectItem>
            <SelectItem value="1">1 minute</SelectItem>
            <SelectItem value="5">5 minutes</SelectItem>
            <SelectItem value="15">15 minutes</SelectItem>
            <SelectItem value="30">30 minutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AlertDialog open={showRegisterPrompt} onOpenChange={setShowRegisterPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Register a passkey to continue</AlertDialogTitle>
            <AlertDialogDescription>
              Quick Unlock requires a registered passkey. Add one now to use biometrics
              or your device PIN to re-open Peerly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setEnableAfterRegister(true);
                setShowRegisterDialog(true);
              }}
            >
              Register Passkey
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PasskeySetupDialog
        open={showRegisterDialog}
        onOpenChange={(v) => {
          setShowRegisterDialog(v);
          if (!v && !hasPasskey) setEnableAfterRegister(false);
        }}
      />
    </div>
  );
};

export default QuickUnlockSettingsCard;
