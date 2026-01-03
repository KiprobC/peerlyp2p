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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Wallet, useWallets, cryptoInfo } from "@/hooks/useWallets";
import { useInternalTransfer, RecipientPreview } from "@/hooks/useInternalTransfer";
import { useMFA } from "@/hooks/useMFA";
import { MFAVerifyDialog } from "@/components/mfa/MFAVerifyDialog";
import { Send, CheckCircle, Star, Shield, AlertCircle, Loader2, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface SendCryptoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  onSuccess?: () => void;
}

export const SendCryptoDialog = ({
  open,
  onOpenChange,
  wallets,
  onSuccess,
}: SendCryptoDialogProps) => {
  const [step, setStep] = useState<"form" | "confirm" | "mfa">("form");
  const [username, setUsername] = useState("");
  const [cryptoType, setCryptoType] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [debouncedUsername, setDebouncedUsername] = useState("");
  const [showMFAVerify, setShowMFAVerify] = useState(false);

  const { loading, recipientPreview, lookupUsername, executeTransfer, clearRecipientPreview } =
    useInternalTransfer();
  
  const { isEnabled: mfaEnabled } = useMFA();

  // Debounce username lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUsername(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  useEffect(() => {
    if (debouncedUsername.length >= 3) {
      lookupUsername(debouncedUsername);
    } else {
      clearRecipientPreview();
    }
  }, [debouncedUsername]);

  const selectedWallet = wallets.find((w) => w.crypto_type === cryptoType);
  const availableBalance = selectedWallet
    ? selectedWallet.balance - selectedWallet.locked_balance
    : 0;
  const amountNum = parseFloat(amount) || 0;
  const isValidAmount = amountNum > 0 && amountNum <= availableBalance;
  const canProceed = recipientPreview && isValidAmount && !loading;

  const handleReset = () => {
    setStep("form");
    setUsername("");
    setAmount("");
    setCryptoType("BTC");
    clearRecipientPreview();
    setShowMFAVerify(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      handleReset();
    }
    onOpenChange(open);
  };

  const handleProceedToConfirm = () => {
    setStep("confirm");
  };

  const handleConfirmTransfer = () => {
    if (mfaEnabled) {
      // Require MFA verification for transfers
      setShowMFAVerify(true);
    } else {
      // No MFA, proceed directly
      executeTransferAction();
    }
  };

  const executeTransferAction = async () => {
    if (!recipientPreview) return;

    const success = await executeTransfer(recipientPreview.username, cryptoType, amountNum);

    if (success) {
      handleClose(false);
      onSuccess?.();
    }
  };

  const handleMFAVerified = () => {
    setShowMFAVerify(false);
    executeTransferAction();
  };

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              {step === "form" ? "Send Crypto" : "Confirm Transfer"}
            </DialogTitle>
            <DialogDescription>
              {step === "form"
                ? "Send crypto instantly to any user by their @username"
                : "Review and confirm your transfer"}
            </DialogDescription>
          </DialogHeader>

          {step === "form" ? (
            <div className="space-y-4 py-4">
              {/* Username Input */}
              <div className="space-y-2">
                <Label htmlFor="username">Recipient Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Recipient Preview */}
              {loading && username.length >= 3 && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking up user...
                </div>
              )}

              {recipientPreview && (
                <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={recipientPreview.avatar_url || ""} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(recipientPreview.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">@{recipientPreview.username}</span>
                        {recipientPreview.is_verified && (
                          <Shield className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          {recipientPreview.rating?.toFixed(1) || "0.0"}
                        </span>
                        <span>{recipientPreview.total_trades || 0} trades</span>
                        <span>
                          Member {formatDistanceToNow(new Date(recipientPreview.member_since), { addSuffix: false })}
                        </span>
                      </div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              )}

              {username.length >= 3 && !loading && !recipientPreview && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Username not found
                </div>
              )}

              {/* Crypto Selection */}
              <div className="space-y-2">
                <Label>Cryptocurrency</Label>
                <Select value={cryptoType} onValueChange={setCryptoType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map((wallet) => {
                      const info = cryptoInfo[wallet.crypto_type] || {
                        name: wallet.crypto_type,
                        icon: "?",
                      };
                      const available = wallet.balance - wallet.locked_balance;
                      return (
                        <SelectItem key={wallet.crypto_type} value={wallet.crypto_type}>
                          <div className="flex items-center gap-2">
                            <span>{info.icon}</span>
                            <span>{info.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({available.toFixed(8)} available)
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount">Amount</Label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setAmount(availableBalance.toString())}
                  >
                    Max: {availableBalance.toFixed(8)} {cryptoType}
                  </button>
                </div>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.00000001"
                  min="0"
                  max={availableBalance}
                />
                {amountNum > availableBalance && (
                  <p className="text-xs text-destructive">Insufficient balance</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Confirmation Summary */}
              <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">You are sending</p>
                  <p className="text-2xl font-bold">
                    {amountNum.toFixed(8)} {cryptoType}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <span>to</span>
                </div>

                {recipientPreview && (
                  <div className="flex items-center justify-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={recipientPreview.avatar_url || ""} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(recipientPreview.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-lg">@{recipientPreview.username}</span>
                        {recipientPreview.is_verified && (
                          <Badge variant="secondary" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Star className="h-3 w-3 text-yellow-500" />
                        {recipientPreview.rating?.toFixed(1) || "0.0"} •{" "}
                        {recipientPreview.total_trades || 0} trades
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠️ This transfer is instant and cannot be undone. Please verify the recipient
                  username before confirming.
                </p>
              </div>

              {mfaEnabled && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-primary flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    You'll need to verify with your authenticator app to complete this transfer.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {step === "form" ? (
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button onClick={handleProceedToConfirm} disabled={!canProceed}>
                  Continue
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep("form")}>
                  Back
                </Button>
                <Button onClick={handleConfirmTransfer} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {mfaEnabled ? "Verify & Send" : "Confirm Transfer"}
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MFA Verification Dialog */}
      <MFAVerifyDialog
        open={showMFAVerify}
        onOpenChange={setShowMFAVerify}
        onVerified={handleMFAVerified}
        title="Verify Transfer"
        description="Enter the 6-digit code from your authenticator app to confirm this transfer"
        actionLabel="Confirm Transfer"
      />
    </>
  );
};
