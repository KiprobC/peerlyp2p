import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { usePasskeyContext } from "@/contexts/PasskeyContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const PasskeySetupDialog = ({ open, onOpenChange }: Props) => {
  const { registerPasskey } = usePasskeyContext();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const defaultName = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return "iPhone";
    if (/Android/.test(ua)) return "Android";
    if (/Mac/.test(ua)) return "Mac";
    if (/Windows/.test(ua)) return "Windows PC";
    return "My device";
  };

  const handleRegister = async () => {
    setBusy(true);
    const ok = await registerPasskey(name.trim() || defaultName());
    setBusy(false);
    if (ok) {
      setName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Fingerprint className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Add a passkey</DialogTitle>
          <DialogDescription className="text-center">
            Use fingerprint, face, or device PIN to sign in faster and confirm sensitive actions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="text-sm font-medium">Device name</label>
          <Input
            placeholder={defaultName()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleRegister} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Fingerprint className="w-4 h-4 mr-2" />}
            Register passkey
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
