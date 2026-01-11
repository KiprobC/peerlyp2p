import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, TrendingUp, TrendingDown, AlertTriangle, Calculator, Percent } from "lucide-react";
import { StepProps } from "../types";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useCurrencyConversion } from "@/hooks/useCountries";
import { cn } from "@/lib/utils";

export const Step5Pricing = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  const { prices } = useCryptoPrices("USD");
  const { convert, formatCurrency } = useCurrencyConversion();

  const marketPriceUSD = prices[formData.crypto_type] || 0;
  const marketPriceLocal = convert(marketPriceUSD, "USD", formData.fiat_currency);
  
  const isMarketPricing = formData.pricing_type === "market";
  const finalPrice = isMarketPricing
    ? marketPriceLocal * (1 + formData.price_margin / 100)
    : parseFloat(formData.fixed_price || "0");

  const totalValue = parseFloat(formData.crypto_amount || "0") * finalPrice;
  
  // Warning if price is far from market (>15% difference)
  const priceDifference = isMarketPricing 
    ? formData.price_margin 
    : ((finalPrice - marketPriceLocal) / marketPriceLocal) * 100;
  const showPriceWarning = Math.abs(priceDifference) > 15;

  const minValid = formData.min_amount && parseFloat(formData.min_amount) > 0;
  const maxValid = formData.max_amount && parseFloat(formData.max_amount) > 0;
  const limitsValid = minValid && maxValid && parseFloat(formData.min_amount) < parseFloat(formData.max_amount);
  
  const priceValid = isMarketPricing || (formData.fixed_price && parseFloat(formData.fixed_price) > 0);
  const canProceed = priceValid && limitsValid;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Set Your Pricing</h2>
        <p className="text-muted-foreground">
          Define how you want to price your {formData.crypto_type}
        </p>
      </div>

      {/* Pricing Type Toggle */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => updateFormData({ pricing_type: "market" })}
          className={cn(
            "p-4 rounded-xl border-2 transition-all text-center",
            isMarketPricing
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-muted-foreground/30"
          )}
        >
          <Percent className={cn("w-6 h-6 mx-auto mb-2", isMarketPricing ? "text-primary" : "text-muted-foreground")} />
          <p className="font-semibold text-sm">Market Price %</p>
          <p className="text-xs text-muted-foreground">Dynamic pricing</p>
        </button>
        <button
          type="button"
          onClick={() => updateFormData({ pricing_type: "fixed" })}
          className={cn(
            "p-4 rounded-xl border-2 transition-all text-center",
            !isMarketPricing
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-muted-foreground/30"
          )}
        >
          <Calculator className={cn("w-6 h-6 mx-auto mb-2", !isMarketPricing ? "text-primary" : "text-muted-foreground")} />
          <p className="font-semibold text-sm">Fixed Price</p>
          <p className="text-xs text-muted-foreground">Set exact rate</p>
        </button>
      </div>

      {/* Pricing Input */}
      {isMarketPricing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Price Margin (%)</Label>
            <p className="text-sm text-muted-foreground">
              Percentage above or below current market price
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateFormData({ price_margin: Math.max(-50, formData.price_margin - 1) })}
              className="h-10 w-10"
            >
              -
            </Button>
            <div className="flex-1 relative">
              <Input
                type="number"
                value={formData.price_margin}
                onChange={(e) => {
                  const value = Math.max(-50, Math.min(50, parseFloat(e.target.value) || 0));
                  updateFormData({ price_margin: value });
                }}
                className="h-12 text-center text-xl font-bold pr-8"
                step={0.1}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => updateFormData({ price_margin: Math.min(50, formData.price_margin + 1) })}
              className="h-10 w-10"
            >
              +
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2">
            {formData.price_margin !== 0 && (
              <>
                {formData.price_margin > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  formData.price_margin > 0 ? "text-green-500" : "text-red-500"
                )}>
                  {formData.price_margin > 0 ? "Above" : "Below"} market price
                </span>
              </>
            )}
            {formData.price_margin === 0 && (
              <span className="text-sm text-muted-foreground">At market price</span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fixed Price per {formData.crypto_type}</Label>
          <div className="relative">
            <Input
              type="number"
              placeholder="Enter price"
              value={formData.fixed_price}
              onChange={(e) => updateFormData({ fixed_price: e.target.value })}
              className="h-12 text-lg pl-12"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
              {formData.fiat_currency}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Market price: {formatCurrency(marketPriceLocal, formData.fiat_currency)}
          </p>
        </div>
      )}

      {/* Price Preview */}
      <div className="p-4 bg-primary/10 rounded-xl text-center space-y-1">
        <p className="text-sm text-muted-foreground">Your Offer Price</p>
        <p className="text-3xl font-bold text-primary">
          {formatCurrency(finalPrice, formData.fiat_currency)}
        </p>
        <p className="text-sm text-muted-foreground">per {formData.crypto_type}</p>
      </div>

      {/* Price Warning */}
      {showPriceWarning && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-500">Price significantly {priceDifference > 0 ? "above" : "below"} market</p>
            <p className="text-muted-foreground">
              {priceDifference > 0 
                ? "Traders may skip offers priced too high above market rates."
                : "You might be selling below fair market value."}
            </p>
          </div>
        </div>
      )}

      {/* Trade Limits */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Trade Limits ({formData.fiat_currency})</Label>
        <p className="text-sm text-muted-foreground">
          Set the minimum and maximum trade amounts
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Minimum</Label>
            <Input
              type="number"
              placeholder="e.g. 1000"
              value={formData.min_amount}
              onChange={(e) => updateFormData({ min_amount: e.target.value })}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Maximum</Label>
            <Input
              type="number"
              placeholder="e.g. 100000"
              value={formData.max_amount}
              onChange={(e) => updateFormData({ max_amount: e.target.value })}
              className="h-11"
            />
          </div>
        </div>
        {formData.min_amount && formData.max_amount && parseFloat(formData.min_amount) >= parseFloat(formData.max_amount) && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Maximum must be greater than minimum
          </p>
        )}
      </div>

      {/* Total Value Preview */}
      {formData.crypto_amount && finalPrice > 0 && (
        <div className="p-4 bg-secondary/50 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Total Offer Value</p>
          <p className="text-xl font-bold">
            {formatCurrency(totalValue, formData.fiat_currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formData.crypto_amount} {formData.crypto_type} × {formatCurrency(finalPrice, formData.fiat_currency)}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1 h-12" disabled={!canProceed}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
