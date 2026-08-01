import { useState } from "react";
import { usePasskeyContext } from "@/contexts/PasskeyContext";
import { useMFA } from "@/hooks/useMFA";

import { PasskeyVerifyDialog } from "@/components/security/PasskeyVerifyDialog";
import { OTPVerificationDialog } from "@/components/security/OTPVerificationDialog";

interface SensitiveActionGuardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;
  description: string;

  actionType: string;

  onVerified: () => Promise<void> | void;
}

export const SensitiveActionGuard = ({
  open,
  onOpenChange,
  title,
  description,
  actionType,
  onVerified,
}: SensitiveActionGuardProps) => {
  const { passkeys } = usePasskeyContext();
  const { isEnabled: mfaEnabled } = useMFA();

  const hasPasskey = passkeys.length > 0;

  const [showPasskey, setShowPasskey] = useState(false);
  const [showOTP, setShowOTP] = useState(false);

  const handleOpen = (value: boolean) => {
    onOpenChange(value);

    if (!value) {
      setShowOTP(false);
      setShowPasskey(false);
      return;
    }

    if (hasPasskey) {
      setShowPasskey(true);
    } else {
      setShowOTP(true);
    }
  };

  return (
    <>
      <PasskeyVerifyDialog
        open={showPasskey && open}
        onOpenChange={(v) => {
          setShowPasskey(v);

          if (!v) {
            onOpenChange(false);
          }
        }}
        title={title}
        description={description}
        onVerified={async () => {
          await onVerified();

          setShowPasskey(false);
          onOpenChange(false);
        }}
        onUseOTP={() => {
          setShowPasskey(false);
          setShowOTP(true);
        }}
      />

      <OTPVerificationDialog
        open={showOTP && open}
        onOpenChange={(v) => {
          setShowOTP(v);

          if (!v) {
            onOpenChange(false);
          }
        }}
        onVerified={async () => {
          await onVerified();

          setShowOTP(false);
          onOpenChange(false);
        }}
        actionType={actionType}
        title={title}
        description={description}
        actionLabel="Continue"
        requireMFA={false}
      />

      {/* Invisible trigger */}
      {open && !showOTP && !showPasskey && handleOpen(true)}
    </>
  );
};