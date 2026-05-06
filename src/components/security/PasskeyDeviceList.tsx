import { useState } from "react";
import { usePasskeys } from "@/hooks/usePasskeys";
import { Button } from "@/components/ui/button";
import { Fingerprint, Trash2, Pencil, Plus, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PasskeySetupDialog } from "./PasskeySetupDialog";
import { formatDistanceToNow } from "date-fns";
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

export const PasskeyDeviceList = () => {
  const { passkeys, loading, renamePasskey, deletePasskey } = usePasskeys();
  const [setupOpen, setSetupOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const startEdit = (id: string, current: string) => {
    setEditingId(id);
    setEditValue(current);
  };
  const saveEdit = async () => {
    if (editingId && editValue.trim()) {
      await renamePasskey(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Your devices</h3>
          <p className="text-sm text-muted-foreground">
            Passkeys let you sign in with biometrics and approve sensitive actions.
          </p>
        </div>
        <Button onClick={() => setSetupOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add passkey
        </Button>
      </div>

      <div className="space-y-2">
        {loading && <div className="text-sm text-muted-foreground">Loading...</div>}
        {!loading && passkeys.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No passkeys yet. Add one to enable biometric 2FA.
          </div>
        )}
        {passkeys.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {editingId === p.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8"
                    maxLength={64}
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="font-medium truncate">{p.device_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.last_used_at
                      ? `Last used ${formatDistanceToNow(new Date(p.last_used_at), { addSuffix: true })}`
                      : `Added ${formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}`}
                  </div>
                </>
              )}
            </div>
            {editingId !== p.id && (
              <>
                <Button variant="ghost" size="icon" onClick={() => startEdit(p.id, p.device_name)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      <PasskeySetupDialog open={setupOpen} onOpenChange={setSetupOpen} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't be able to use this device for biometric 2FA anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deletePasskey(deleteId);
                setDeleteId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
