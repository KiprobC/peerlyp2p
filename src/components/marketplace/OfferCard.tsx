import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Shield, Clock, ArrowUpRight, ArrowDownLeft, ThumbsUp } from "lucide-react";
import { isUserOnline } from "@/hooks/useOnlineStatus";

interface OfferCardProps {
  offer: {
    id: string;
    type: "buy" | "sell";
    crypto: string;
    cryptoAmount: number;
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
  };
  onAction?: () => void;
}

const OfferCard = ({ offer, onAction }: OfferCardProps) => {
  const isBuy = offer.type === "buy";
  const isOnline = isUserOnline(offer.trader.lastSeen || null);

  return (
    <div className="glass-card hover:border-primary/30 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        {/* Trader Info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-primary">
              {offer.trader.avatar ? (
                <img src={offer.trader.avatar} alt={offer.trader.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                offer.trader.name.charAt(0)
              )}
            </div>
            {/* Online Status Indicator */}
            <div 
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
                isOnline ? "bg-amber-400" : "bg-muted-foreground/50"
              }`}
              title={isOnline ? "Online" : "Offline"}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{offer.trader.name}</span>
              {offer.trader.verified && (
                <Shield className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-accent fill-accent" />
                <span>{offer.trader.rating.toFixed(1)}</span>
              </div>
              <span>•</span>
              <span>{offer.trader.trades} trades</span>
              {offer.trader.positiveCount !== undefined && offer.trader.positiveCount > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1 text-green-500">
                    <ThumbsUp className="w-3 h-3" />
                    <span>{offer.trader.positiveCount}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Trade Type Badge */}
        <Badge variant={isBuy ? "default" : "destructive"} className="flex items-center gap-1">
          {isBuy ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
          {isBuy ? "Buying" : "Selling"}
        </Badge>
      </div>

      {/* Price & Crypto */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-foreground">
            {offer.fiatCurrency} {offer.price.toLocaleString()}
          </span>
          <span className="text-muted-foreground">/ {offer.crypto}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Limit: {offer.fiatCurrency} {offer.minAmount.toLocaleString()} - {offer.maxAmount.toLocaleString()}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="flex flex-wrap gap-2 mb-4">
        {offer.paymentMethods.map((method) => (
          <Badge key={method} variant="secondary" className="text-xs">
            {method}
          </Badge>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{offer.timeLimit} min</span>
        </div>
        <Button
          variant={isBuy ? "destructive" : "default"}
          size="sm"
          onClick={onAction}
        >
          {isBuy ? "Sell" : "Buy"} {offer.crypto}
        </Button>
      </div>
    </div>
  );
};

export default OfferCard;
