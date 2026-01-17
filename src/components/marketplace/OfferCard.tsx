import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CheckCircle2,
  Banknote,
  Smartphone,
  Building2,
  Wallet
} from "lucide-react";
import { isUserOnline } from "@/hooks/useOnlineStatus";
import TraderBadge from "./TraderBadge";
import { cn } from "@/lib/utils";

interface OfferCardProps {
  offer: {
    id: string;
    type: "buy" | "sell";
    crypto: string;
    cryptoAmount: number;
    availableAmount?: number;
    fiatCurrency: string;
    price: number;
    minAmount: number;
    maxAmount: number;
    paymentMethods: string[];
    trader: {
      name: string;
      avatar?: string;
      rating: number;
      trades: number;
      verified: boolean;
      positiveCount?: number;
      lastSeen?: string | null;
      successfulTrades?: number;
    };
    timeLimit: number;
    priceMargin?: number;
  };
  onAction?: () => void;
}

const getPaymentIcon = (method: string) => {
  const lowerMethod = method.toLowerCase();
  if (lowerMethod.includes("mpesa") || lowerMethod.includes("airtel") || lowerMethod.includes("mobile")) {
    return Smartphone;
  }
  if (lowerMethod.includes("bank")) {
    return Building2;
  }
  if (lowerMethod.includes("cash")) {
    return Banknote;
  }
  return Wallet;
};

const OfferCard = ({ offer, onAction }: OfferCardProps) => {
  const isBuy = offer.type === "buy";
  const isOnline = isUserOnline(offer.trader.lastSeen || null);
  
  const totalAmount = offer.cryptoAmount ?? 0;
  const availableAmount = offer.availableAmount ?? totalAmount;
  const hasPartialFill = totalAmount > 0 && availableAmount < totalAmount;
  const fillPercentage = totalAmount > 0 ? ((totalAmount - availableAmount) / totalAmount) * 100 : 0;
  const completionRate = offer.trader.trades > 0 
    ? Math.round(((offer.trader.successfulTrades ?? offer.trader.trades) / offer.trader.trades) * 100) 
    : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-3 hover:border-primary/30 transition-all duration-150 group">
      {/* Row 1: Trader + Type Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Compact Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold text-foreground overflow-hidden">
              {offer.trader.avatar ? (
                <img src={offer.trader.avatar} alt={offer.trader.name} className="w-full h-full object-cover" />
              ) : (
                offer.trader.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card",
              isOnline ? "bg-green-500" : "bg-muted-foreground/40"
            )} />
          </div>
          
          {/* Trader Info - Compact */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-medium text-sm text-foreground truncate max-w-[100px]">
                {offer.trader.name}
              </span>
              <TraderBadge 
                totalTrades={offer.trader.trades} 
                successfulTrades={offer.trader.successfulTrades}
                size="sm"
              />
              {offer.trader.verified && (
                <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{offer.trader.trades} trades</span>
              <span className="text-border">•</span>
              <span className={cn(
                completionRate >= 95 ? "text-green-500" : 
                completionRate >= 80 ? "text-foreground" : "text-muted-foreground"
              )}>
                {completionRate}%
              </span>
            </div>
          </div>
        </div>

        <Badge 
          variant={isBuy ? "default" : "destructive"} 
          className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 font-medium h-5"
        >
          {isBuy ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
          {isBuy ? "Buy" : "Sell"}
        </Badge>
      </div>

      {/* Row 2: Price + Available (main focus) */}
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold text-foreground">
            {offer.fiatCurrency} {offer.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-muted-foreground">/{offer.crypto}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className={cn(
            "font-medium",
            availableAmount > 0 ? "text-foreground" : "text-destructive"
          )}>
            {availableAmount.toFixed(offer.crypto === "USDT" ? 2 : 4)} {offer.crypto}
          </span>
          {hasPartialFill && (
            <div className="w-10 h-1 bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary/60 rounded-full"
                style={{ width: `${100 - fillPercentage}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Limits + Payment Methods (inline) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11px] text-muted-foreground">
          <span className="text-foreground font-medium">
            {offer.fiatCurrency} {offer.minAmount.toLocaleString()}
          </span>
          <span className="mx-1">–</span>
          <span className="text-foreground font-medium">
            {offer.maxAmount.toLocaleString()}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {offer.paymentMethods.slice(0, 2).map((method) => {
            const Icon = getPaymentIcon(method);
            return (
              <div 
                key={method}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-secondary/60 rounded text-[10px] text-muted-foreground"
              >
                <Icon className="w-2.5 h-2.5" />
                <span className="truncate max-w-[50px] hidden sm:inline">{method}</span>
              </div>
            );
          })}
          {offer.paymentMethods.length > 2 && (
            <div className="px-1 py-0.5 bg-secondary/60 rounded text-[10px] text-muted-foreground">
              +{offer.paymentMethods.length - 2}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Time + CTA */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{offer.timeLimit}m</span>
        </div>
        <Button
          variant={isBuy ? "destructive" : "default"}
          size="sm"
          className="h-7 px-3 font-medium text-xs"
          onClick={onAction}
          disabled={!isBuy && availableAmount <= 0}
        >
          {!isBuy && availableAmount <= 0 
            ? "Sold Out" 
            : `${isBuy ? "Sell" : "Buy"} ${offer.crypto}`
          }
        </Button>
      </div>
    </div>
  );
};

export default OfferCard;
