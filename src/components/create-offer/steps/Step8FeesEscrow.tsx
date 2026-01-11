import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, ArrowLeft, Lock, Coins, Receipt, AlertTriangle } from "lucide-react";
import { StepProps } from "../types";
import { usePlatformFees } from "@/hooks/usePlatformFees";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useCurrencyConversion } from "@/hooks/useCountries";
import { cn } from "@/lib/utils";

export const Step8FeesEscrow = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  const { calculateFee } = usePlatformFees();
  const { prices } = useCryptoPrices("USD");
  const { convert, formatCurrency } = useCurrencyConversion();

  const cryptoAmount = parseFloat(formData.crypto_amount || "0");
  const marketPrice = convert(prices[formData.crypto_type] || 0, "USD", formData.fiat_currency);
  const finalPrice = formData.pricing_type === "market"
    ? marketPrice * (1 + formData.price_margin / 100)
    : parseFloat(formData.fixed_price || "0");

  const totalFiatValue = cryptoAmount * finalPrice;
  const tradeFee = calculateFee("trade", cryptoAmount);
  const netAmount = cryptoAmount - tradeFee;
  const isSellOffer = formData.type === "sell";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Fees & Escrow</h2>
        <p className="text-muted-foreground">Review the costs and escrow requirements</p>
      </div>

      {/* Fee Breakdown */}
      <div className="space-y-3">
        <div className="p-4 bg-card border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              <span>Offer Amount</span>
            </div>
            <span className="font-mono font-semibold">{cryptoAmount.toFixed(6)} {formData.crypto_type}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              <span>Platform Fee</span>
            </div>
            <span className="font-mono">-{tradeFee.toFixed(6)} {formData.crypto_type}</span>
          </div>
          <div className="border-t pt-3 flex items-center justify-between">
            <span className="font-medium">Net Amount</span>
            <span className="font-mono font-bold text-primary">{netAmount.toFixed(6)} {formData.crypto_type}</span>
          </div>
        </div>

        <div className="p-4 bg-secondary/50 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Estimated Value</p>
          <p className="text-2xl font-bold">{formatCurrency(totalFiatValue, formData.fiat_currency)}</p>
        </div>
      </div>

      {/* Escrow Notice */}
      {isSellOffer && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-yellow-500">
            <Lock className="w-5 h-5" />
            <span className="font-semibold">Escrow Requirement</span>
          </div>
          <p className="text-sm text-muted-foreground">
            When a buyer initiates a trade, <strong>{cryptoAmount.toFixed(6)} {formData.crypto_type}</strong> will be locked in escrow until you confirm payment receipt.
          </p>
        </div>
      )}

      {/* Confirmation Checkbox */}
      <div className={cn(
        "p-4 rounded-xl border-2 transition-colors",
        formData.escrow_confirmed ? "border-primary bg-primary/5" : "border-border"
      )}>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={formData.escrow_confirmed}
            onCheckedChange={(checked) => updateFormData({ escrow_confirmed: !!checked })}
            className="mt-0.5"
          />
          <div className="text-sm">
            <p className="font-medium">I understand and agree</p>
            <p className="text-muted-foreground">
              {isSellOffer
                ? "My crypto will be locked in escrow when trades are initiated. I will only release after confirming payment."
                : "The seller's crypto will be locked in escrow. I must pay within the time limit or the trade will be cancelled."}
            </p>
          </div>
        </label>
      </div>

      {!formData.escrow_confirmed && (
        <div className="flex items-center gap-2 text-sm text-yellow-500">
          <AlertTriangle className="w-4 h-4" />
          <span>Please confirm you understand the escrow process</span>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1 h-12" disabled={!formData.escrow_confirmed}>
          Review Offer
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
