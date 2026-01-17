import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Shield, Clock, ArrowUpRight, ArrowDownLeft, ThumbsUp, TrendingUp } from "lucide-react";
import { isUserOnline } from "@/hooks/useOnlineStatus";

interface OfferCardProps {
  offer: {
    id: string;
    type: "buy" | "sell";
    crypto: string;
    cryptoAmount: number;
    availableAmount?: number; // Available for trading (crypto_amount - reserved_amount)
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
    };
    timeLimit: number;
    priceMargin?: number;
  };
  onAction?: () => void;
}

const OfferCard = ({ offer, onAction }: OfferCardProps) => {
  const isBuy = offer.type === "buy";
  const isOnline = isUserOnline(offer.trader.lastSeen || null);
  const margin = offer.priceMargin || 0;
  
  // Calculate available amount (for sell offers, show remaining balance)
  const totalAmount = offer.cryptoAmount ?? 0;
  const availableAmount = offer.availableAmount ?? totalAmount;
  const hasPartialFill = totalAmount > 0 && availableAmount < totalAmount;
  const fillPercentage = totalAmount > 0 ? ((totalAmount - availableAmount) / totalAmount) * 100 : 0;

  return (
    <div className="glass-card p-3 hover:border-primary/30 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-2">
        {/* Trader Info */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-primary">
              {offer.trader.avatar ? (
                <img src={offer.trader.avatar} alt={offer.trader.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                offer.trader.name.charAt(0)
              )}
            </div>
            <div 
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                isOnline ? "bg-amber-400" : "bg-muted-foreground/50"
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm text-foreground">@{offer.trader.name}</span>
              {offer.trader.verified && (
                <Shield className="w-3 h-3 text-primary" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 text-accent fill-accent" />
                <span>{offer.trader.rating.toFixed(1)}</span>
              </div>
              <span>•</span>
              <span>{offer.trader.trades} trades</span>
              {offer.trader.positiveCount !== undefined && offer.trader.positiveCount > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-0.5 text-green-500">
                    <ThumbsUp className="w-2.5 h-2.5" />
                    <span>{offer.trader.positiveCount}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trade Type Badge */}
        <Badge variant={isBuy ? "default" : "destructive"} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 h-5">
          {isBuy ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
          {isBuy ? "Buying" : "Selling"}
        </Badge>
      </div>

      {/* Price & Crypto */}
      <div className="mb-2">
        <div className="flex items-baseline gap-1.5 mb-0.5">
          <span className="text-lg font-bold text-foreground">
            {offer.fiatCurrency} {offer.price.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">/ {offer.crypto}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            Limit: {offer.fiatCurrency} {offer.minAmount.toLocaleString()} - {offer.maxAmount.toLocaleString()}
          </span>
          <Badge 
            variant={margin > 0 ? "default" : margin < 0 ? "destructive" : "secondary"} 
            className="text-[9px] px-1 py-0 h-4"
          >
            {margin > 0 ? "+" : ""}{margin}%
          </Badge>
        </div>
      </div>

      {/* Available Balance Indicator (for sell offers) */}
      {!isBuy && (
        <div className="mb-2 p-2 bg-secondary/30 rounded-md">
          <div className="flex items-center justify-between text-xs mb-1">
            <TrendingUp className="w-3 h-3 text-muted-foreground" />
            <span className={`font-medium ${availableAmount > 0 ? 'text-foreground' : 'text-destructive'}`}>
              {availableAmount.toFixed(offer.crypto === "USDT" ? 2 : 6)} {offer.crypto}
            </span>
          </div>
          {hasPartialFill && (
            <div className="relative h-1 bg-secondary rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-primary/60 rounded-full transition-all"
                style={{ width: `${fillPercentage}%` }}
              />
            </div>
          )}
          {hasPartialFill && (
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              {fillPercentage.toFixed(0)}% reserved in trades
            </span>
          )}
        </div>
      )}

      {/* Payment Methods */}
      <div className="flex flex-wrap gap-1 mb-2">
        {offer.paymentMethods.map((method) => (
          <Badge key={method} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {method}
          </Badge>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{offer.timeLimit} min</span>
        </div>
        <Button
          variant={isBuy ? "destructive" : "default"}
          size="sm"
          className="h-7 text-xs px-3"
          onClick={onAction}
          disabled={!isBuy && availableAmount <= 0}
        >
          {!isBuy && availableAmount <= 0 ? "Sold Out" : `${isBuy ? "Sell" : "Buy"} ${offer.crypto}`}
        </Button>
      </div>
    </div>
  );
};

export default OfferCard;