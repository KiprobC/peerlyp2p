import { useState } from "react";
import { ArrowLeft, Shield, Lock, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TraderProfilePanel } from "@/components/trade/TraderProfilePanel";

interface TradeHeaderProps {
  tradeId: string;
  cryptoAmount: number;
  cryptoType: string;
  fiatAmount: number;
  fiatCurrency: string;
  status: string;
  expiresAt: string | null;
  counterpartyUsername: string | null;
  counterpartyVerified: boolean;
  counterpartyId?: string;
  escrowLocked: boolean;
  escrowReleased: boolean;
  onBack: () => void;
  onExpired?: () => void;
}

const statusConfig: Record<string, { label: string; shortLabel: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Awaiting Escrow", shortLabel: "Pending", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Clock },
  confirmed: { label: "Escrow Locked", shortLabel: "Secured", color: "bg-primary/10 text-primary border-primary/20", icon: Lock },
  payment_sent: { label: "Payment Sent", shortLabel: "Paid", color: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: CheckCircle },
  completed: { label: "Completed", shortLabel: "Done", color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle },
  disputed: { label: "Disputed", shortLabel: "Dispute", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
  cancelled: { label: "Cancelled", shortLabel: "Cancelled", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

export const TradeHeader = ({
  tradeId,
  cryptoAmount,
  cryptoType,
  fiatAmount,
  fiatCurrency,
  status,
  expiresAt,
  counterpartyUsername,
  counterpartyVerified,
  counterpartyId,
  escrowLocked,
  escrowReleased,
  onBack,
  onExpired,
}: TradeHeaderProps) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const statusInfo = statusConfig[status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-3 max-w-5xl">
          <div className="flex items-center justify-between h-12 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0 rounded-full" 
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <button
                className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition-opacity cursor-pointer"
                onClick={() => counterpartyId && setProfileOpen(true)}
              >
                <span className="font-semibold text-sm truncate">@{counterpartyUsername || "User"}</span>
                {counterpartyVerified && (
                  <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                )}
              </button>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden xs:flex items-center gap-1 text-xs">
                <span className="font-bold">{cryptoAmount}</span>
                <span className="text-muted-foreground">{cryptoType}</span>
                <span className="text-muted-foreground">≈</span>
                <span className="font-medium">{fiatCurrency} {fiatAmount.toLocaleString()}</span>
              </div>
              
              <Badge 
                variant="outline" 
                className={cn("text-[10px] px-2 py-0.5 font-medium border rounded-full", statusInfo.color)}
              >
                <StatusIcon className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">{statusInfo.label}</span>
                <span className="sm:hidden">{statusInfo.shortLabel}</span>
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {counterpartyId && (
        <TraderProfilePanel
          targetUserId={counterpartyId}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      )}
    </>
  );
};
