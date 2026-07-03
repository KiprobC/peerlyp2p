import { Fingerprint } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuickUnlock } from "@/hooks/useQuickUnlock";
import { usePasskeys } from "@/hooks/usePasskeys";

export const QuickUnlockSettingsCard = () => {
  const { settings, updateSettings } = useQuickUnlock();
  const { passkeys } = usePasskeys();
  const hasPasskey = passkeys.length > 0;

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

      {!hasPasskey && (
        <p className="text-xs text-amber-500">
          Register a passkey above to enable Quick Unlock.
        </p>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="qu-enable" className="text-sm">Enable Quick Unlock</Label>
        <Switch
          id="qu-enable"
          checked={settings.enabled}
          disabled={!hasPasskey}
          onCheckedChange={(v) => updateSettings({ enabled: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="qu-open" className="text-sm">Require unlock on app open</Label>
        <Switch
          id="qu-open"
          checked={settings.requireOnOpen}
          disabled={!settings.enabled}
          onCheckedChange={(v) => updateSettings({ requireOnOpen: v })}
        />
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
    </div>
  );
};

export default QuickUnlockSettingsCard;
