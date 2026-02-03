import { useNavigate } from "react-router-dom";
import { useTradeAuthorization } from "@/hooks/useTradeAuthorization";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TradeGuardProps {
  tradeId: string | undefined;
  children: React.ReactNode;
}

/**
 * Guards trade routes to ensure only authorized users can access.
 * Only buyers, sellers, or assigned moderators/admins can view a trade.
 */
export const TradeGuard = ({ tradeId, children }: TradeGuardProps) => {
  const navigate = useNavigate();
  const { isAuthorized, loading, error } = useTradeAuthorization(tradeId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying trade access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-card text-center max-w-md w-full p-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            {error || "You are not authorized to view this trade."}
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/trades")} className="w-full">
              View My Trades
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default TradeGuard;
