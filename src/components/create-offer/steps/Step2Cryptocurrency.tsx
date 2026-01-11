import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Wallet, AlertTriangle, RefreshCw, Lock, TrendingUp } from "lucide-react";
import { StepProps } from "../types";
import { useAvailableBalance } from "@/hooks/useAvailableBalance";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useCurrencyConversion } from "@/hooks/useCountries";
import { cn } from "@/lib/utils";

const CRYPTO_OPTIONS = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿", color: "text-orange-500", bgColor: "bg-orange-500/10" },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { symbol: "USDT", name: "Tether", icon: "$", color: "text-green-500", bgColor: "bg-green-500/10" },
];

export const Step2Cryptocurrency = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  const { getAvailableBalance, getBalanceDetails, refetch: refetchBalance, loading: balanceLoading } = useAvailableBalance();
  const { prices, loading: pricesLoading, refetch: refetchPrices } = useCryptoPrices("USD");
  const { convert, formatCurrency } = useCurrencyConversion();

  const isSellOffer = formData.type === "sell";
  const availableBalance = getAvailableBalance(formData.crypto_type);
  const balanceDetails = getBalanceDetails(formData.crypto_type);
  const enteredAmount = parseFloat(formData.crypto_amount || "0");
  const hasInsufficientBalance = isSellOffer && enteredAmount > availableBalance;
  const marketPriceUSD = prices[formData.crypto_type] || 0;
  const marketPriceLocal = convert(marketPriceUSD, "USD", formData.fiat_currency);

  const canProceed = formData.crypto_amount && 
    parseFloat(formData.crypto_amount) > 0 && 
    (!isSellOffer || !hasInsufficientBalance);

  const handleUseMax = () => {
    if (availableBalance > 0) {
      updateFormData({ crypto_amount: availableBalance.toString() });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Select Cryptocurrency</h2>
        <p className="text-muted-foreground">
          Choose which crypto you want to {formData.type} and specify the amount
        </p>
      </div>

      {/* Crypto Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Cryptocurrency</Label>
        <div className="grid grid-cols-3 gap-3">
          {CRYPTO_OPTIONS.map((crypto) => {
            const isSelected = formData.crypto_type === crypto.symbol;
            return (
              <button
                key={crypto.symbol}
                type="button"
                onClick={() => updateFormData({ crypto_type: crypto.symbol, crypto_amount: "" })}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all text-center",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  isSelected
                    ? `border-primary ${crypto.bgColor}`
                    : "border-border bg-card hover:border-muted-foreground/30"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-xl font-bold",
                  crypto.bgColor, crypto.color
                )}>
                  {crypto.icon}
                </div>
                <p className="font-semibold text-sm">{crypto.symbol}</p>
                <p className="text-xs text-muted-foreground">{crypto.name}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Market Price */}
      <div className="p-4 bg-secondary/50 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Market Price</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={refetchPrices}
            disabled={pricesLoading}
            className="h-7 px-2"
          >
            <RefreshCw className={cn("w-3 h-3", pricesLoading && "animate-spin")} />
          </Button>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{formatCurrency(marketPriceLocal, formData.fiat_currency)}</span>
          <span className="text-sm text-muted-foreground">per {formData.crypto_type}</span>
        </div>
      </div>

      {/* Balance Info (Sell offers only) */}
      {isSellOffer && (
        <div className={cn(
          "p-4 rounded-xl border-2 space-y-3",
          hasInsufficientBalance 
            ? "bg-destructive/10 border-destructive/30" 
            : "bg-primary/5 border-primary/30"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">Your {formData.crypto_type} Balance</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={refetchBalance}
              disabled={balanceLoading}
              className="h-7 px-2"
            >
              <RefreshCw className={cn("w-3 h-3", balanceLoading && "animate-spin")} />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 bg-background/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="font-mono font-semibold text-sm">
                {(balanceDetails?.total_balance || 0).toFixed(6)}
              </p>
            </div>
            <div className="p-2 bg-background/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> In Use
              </p>
              <p className="font-mono font-semibold text-sm text-yellow-500">
                {((balanceDetails?.locked_balance || 0) + (balanceDetails?.reserved_balance || 0)).toFixed(6)}
              </p>
            </div>
            <div className="p-2 bg-background/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Available</p>
              <p className="font-mono font-semibold text-sm text-green-500">
                {availableBalance.toFixed(6)}
              </p>
            </div>
          </div>

          {availableBalance <= 0 && (
            <div className="flex items-center gap-2 p-3 bg-destructive/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                You don't have any available {formData.crypto_type} to sell. Deposit funds first.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Amount Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Amount to {formData.type} ({formData.crypto_type})
          </Label>
          {isSellOffer && availableBalance > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-primary"
              onClick={handleUseMax}
            >
              Use Max ({availableBalance.toFixed(6)})
            </Button>
          )}
        </div>
        <Input
          type="number"
          step="any"
          placeholder="0.00000000"
          value={formData.crypto_amount}
          onChange={(e) => updateFormData({ crypto_amount: e.target.value })}
          className={cn(
            "h-12 text-lg font-mono",
            hasInsufficientBalance && "border-destructive focus-visible:ring-destructive"
          )}
        />
        {hasInsufficientBalance && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Amount exceeds available balance
          </p>
        )}
        {formData.crypto_amount && !hasInsufficientBalance && (
          <p className="text-sm text-muted-foreground">
            ≈ {formatCurrency(parseFloat(formData.crypto_amount) * marketPriceLocal, formData.fiat_currency)} at current market price
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={onNext} 
          className="flex-1 h-12" 
          disabled={!canProceed || (isSellOffer && availableBalance <= 0)}
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};
