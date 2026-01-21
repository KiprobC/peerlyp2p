import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PartialFillNoticeProps {
  requestedCrypto: number;
  availableCrypto: number;
  cryptoType: string;
  fiatCurrency: string;
  pricePerUnit: number;
  onAdjustToMax: () => void;
  onDismiss: () => void;
}

export const PartialFillNotice = ({
  requestedCrypto,
  availableCrypto,
  cryptoType,
  fiatCurrency,
  pricePerUnit,
  onAdjustToMax,
  onDismiss,
}: PartialFillNoticeProps) => {
  const maxFiatAmount = availableCrypto * pricePerUnit;
  const isFullyFilled = availableCrypto <= 0;

  return (
    <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-full bg-amber-500/20 shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h4 className="font-semibold text-amber-600 dark:text-amber-400">
            {isFullyFilled ? "Offer Fully Filled" : "Offer Partially Filled"}
          </h4>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isFullyFilled 
              ? "Another trader just completed this offer."
              : "Another trader filled part of this offer while you were reviewing."}
          </p>
        </div>
      </div>

      {!isFullyFilled && (
        <>
          {/* Amount Comparison */}
          <div className="flex items-center justify-between p-3 bg-background/80 rounded-lg mb-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">You requested</p>
              <p className="font-semibold text-destructive line-through">
                {requestedCrypto.toFixed(cryptoType === "USDT" ? 2 : 6)} {cryptoType}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mx-2" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Now available</p>
              <p className="font-semibold text-primary">
                {availableCrypto.toFixed(cryptoType === "USDT" ? 2 : 6)} {cryptoType}
              </p>
            </div>
          </div>

          {/* Fiat equivalent */}
          <p className="text-xs text-center text-muted-foreground mb-4">
            ≈ {fiatCurrency} {maxFiatAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onDismiss}
            >
              Try Another Offer
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              onClick={onAdjustToMax}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Adjust to Max
            </Button>
          </div>
        </>
      )}

      {isFullyFilled && (
        <div className="flex justify-center mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
          >
            Find Another Offer
          </Button>
        </div>
      )}
    </div>
  );
};
