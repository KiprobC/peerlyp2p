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

// Payment method icon mapper
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
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-lg transition-all duration-200 group">
      {/* Header: Trader Info */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Avatar with online indicator */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-foreground overflow-hidden">
              {offer.trader.avatar ? (
                <img 
                  src={offer.trader.avatar} 
                  alt={offer.trader.name} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                offer.trader.name.charAt(0).toUpperCase()
              )}
            </div>
            <div 
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                isOnline ? "bg-green-500" : "bg-muted-foreground/40"
              )}
            />
          </div>
          
          {/* Trader details */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate max-w-[120px]">
                {offer.trader.name}
              </span>
              <TraderBadge 
                totalTrades={offer.trader.trades} 
                successfulTrades={offer.trader.successfulTrades}
                size="sm"
              />
              {offer.trader.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="font-medium">{offer.trader.trades} trades</span>
              <span className="text-border">|</span>
              <span className={cn(
                "font-medium",
                completionRate >= 95 ? "text-green-500" : 
                completionRate >= 80 ? "text-foreground" : "text-muted-foreground"
              )}>
                {completionRate}% completion
              </span>
            </div>
          </div>
        </div>

        {/* Trade Type Badge */}
        <Badge 
          variant={isBuy ? "default" : "destructive"} 
          className="flex items-center gap-1 text-xs px-2 py-1 font-medium"
        >
          {isBuy ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {isBuy ? "Buy" : "Sell"}
        </Badge>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mb-4" />

      {/* Price Section - Dominant */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-foreground">
            {offer.fiatCurrency} {offer.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-sm text-muted-foreground">/ {offer.crypto}</span>
        </div>
        
        {/* Available & Limits */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Available:</span>
            <span className={cn(
              "font-semibold",
              availableAmount > 0 ? "text-foreground" : "text-destructive"
            )}>
              {availableAmount.toFixed(offer.crypto === "USDT" ? 2 : 6)} {offer.crypto}
            </span>
          </div>
          {hasPartialFill && (
            <div className="flex-1 max-w-[80px]">
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${100 - fillPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Limits */}
      <div className="bg-secondary/50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Limit</span>
          <span className="font-medium text-foreground">
            {offer.fiatCurrency} {offer.minAmount.toLocaleString()} – {offer.maxAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {offer.paymentMethods.slice(0, 3).map((method) => {
          const Icon = getPaymentIcon(method);
          return (
            <div 
              key={method}
              className="flex items-center gap-1 px-2 py-1 bg-secondary/70 rounded-md text-xs text-muted-foreground"
            >
              <Icon className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{method}</span>
            </div>
          );
        })}
        {offer.paymentMethods.length > 3 && (
          <div className="px-2 py-1 bg-secondary/70 rounded-md text-xs text-muted-foreground">
            +{offer.paymentMethods.length - 3}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{offer.timeLimit} min</span>
        </div>
        <Button
          variant={isBuy ? "destructive" : "default"}
          size="sm"
          className="h-8 px-4 font-semibold text-xs"
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
