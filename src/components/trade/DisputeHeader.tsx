import { 
  ArrowLeft, 
  Shield, 
  Lock, 
  AlertTriangle, 
  Scale, 
  CheckCircle, 
  XCircle,
  Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { DisputeModerator, DisputeAssignment } from "@/hooks/useDisputeModerator";

interface DisputeHeaderProps {
  tradeId: string;
  cryptoAmount: number;
  cryptoType: string;
  fiatAmount: number;
  fiatCurrency: string;
  status: string;
  escrowLocked: boolean;
  moderator: DisputeModerator | null;
  assignment: DisputeAssignment | null;
  onBack: () => void;
}

const getDisputeStatus = (status: string, assignment: DisputeAssignment | null) => {
  if (status !== "disputed") return null;
  
  if (!assignment) {
    return { label: "Assigning Moderator", color: "text-amber-500 bg-amber-500/10" };
  }
  
  switch (assignment.status) {
    case "assigned":
      return { label: "Under Review", color: "text-orange-500 bg-orange-500/10" };
    case "in_review":
      return { label: "In Review", color: "text-purple-500 bg-purple-500/10" };
    case "resolved":
      return { label: "Resolved", color: "text-green-500 bg-green-500/10" };
    default:
      return { label: "Pending", color: "text-muted-foreground bg-muted" };
  }
};

export const DisputeHeader = ({
  tradeId,
  cryptoAmount,
  cryptoType,
  fiatAmount,
  fiatCurrency,
  status,
  escrowLocked,
  moderator,
  assignment,
  onBack,
}: DisputeHeaderProps) => {
  const disputeStatus = getDisputeStatus(status, assignment);
  const isResolved = assignment?.status === "resolved";

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-3 max-w-4xl">
        {/* Main header row */}
        <div className="flex items-center justify-between h-12 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 shrink-0" 
              onClick={onBack}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-muted-foreground">Trade</span>
              <span className="text-xs font-mono truncate">#{tradeId.slice(0, 8)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            {/* Trade amount */}
            <div className="hidden sm:flex items-center gap-1 text-xs">
              <span className="font-bold">{cryptoAmount}</span>
              <span className="text-muted-foreground">{cryptoType}</span>
              <span className="text-muted-foreground">≈</span>
              <span className="font-medium">{fiatCurrency} {fiatAmount.toLocaleString()}</span>
            </div>
            
            {/* Escrow status */}
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] px-2 py-0.5 font-medium border gap-1",
                escrowLocked 
                  ? "text-primary bg-primary/10 border-primary/30" 
                  : "text-muted-foreground"
              )}
            >
              <Lock className="w-3 h-3" />
              {escrowLocked ? "Secured" : "Unlocked"}
            </Badge>
            
            {/* Dispute status */}
            {disputeStatus && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] px-2 py-0.5 font-medium border gap-1",
                  disputeStatus.color
                )}
              >
                {isResolved ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <Scale className="w-3 h-3" />
                )}
                {disputeStatus.label}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Moderator presence row */}
        {status === "disputed" && moderator && (
          <div className="flex items-center justify-between py-2 border-t border-border/50">
            <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-purple-500/20 text-purple-500">
                M
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-purple-500" />
              <span className="text-xs font-medium">Moderator</span>
              <span className="text-[10px] text-muted-foreground">assigned</span>
            </div>
            </div>
            
            {/* Online indicator */}
            <div className="flex items-center gap-1.5">
              <Circle 
                className={cn(
                  "w-2 h-2 fill-current",
                  moderator.is_online ? "text-green-500" : "text-muted-foreground"
                )} 
              />
              <span className="text-[10px] text-muted-foreground">
                {moderator.is_online ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
