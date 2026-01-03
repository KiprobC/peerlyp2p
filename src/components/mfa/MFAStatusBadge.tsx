import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldX } from "lucide-react";

interface MFAStatusBadgeProps {
  enabled: boolean;
  variant?: "default" | "compact";
}

export const MFAStatusBadge = ({ enabled, variant = "default" }: MFAStatusBadgeProps) => {
  if (variant === "compact") {
    return enabled ? (
      <span title="2FA Enabled">
        <ShieldCheck className="h-4 w-4 text-green-500" />
      </span>
    ) : (
      <span title="2FA Disabled">
        <ShieldX className="h-4 w-4 text-muted-foreground" />
      </span>
    );
  }

  return enabled ? (
    <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
      <ShieldCheck className="h-3 w-3 mr-1" />
      2FA Enabled
    </Badge>
  ) : (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      <Shield className="h-3 w-3 mr-1" />
      2FA Disabled
    </Badge>
  );
};
