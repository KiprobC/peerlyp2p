import { useState } from "react";
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

type InputMode = "crypto" | "fiat";

export const Step2Cryptocurrency = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  const { getAvailableBalance, getBalanceDetails, refetch: refetchBalance, loading: balanceLoading } = useAvailableBalance();
  const { prices, loading: pricesLoading, refetch: refetchPrices } = useCryptoPrices("USD");
  const { convert, formatCurrency } = useCurrencyConversion();

  const [inputMode, setInputMode] = useState<InputMode>("crypto");
  const [fiatAmount, setFiatAmount] = useState("");

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
      if (inputMode === "fiat") {
        setFiatAmount((availableBalance * marketPriceLocal).toFixed(2));
      }
    }
  };

  const handleCryptoAmountChange = (value: string) => {
    updateFormData({ crypto_amount: value });
    if (value && marketPriceLocal > 0) {
      setFiatAmount((parseFloat(value) * marketPriceLocal).toFixed(2));
    } else {
      setFiatAmount("");
    }
  };

  const handleFiatAmountChange = (value: string) => {
    setFiatAmount(value);
    if (value && marketPriceLocal > 0) {
      const cryptoValue = parseFloat(value) / marketPriceLocal;
      updateFormData({ crypto_amount: cryptoValue.toFixed(8) });
    } else {
      updateFormData({ crypto_amount: "" });
    }
  };

  const handleModeSwitch = (mode: InputMode) => {
    setInputMode(mode);
    // Sync values when switching
    if (mode === "fiat" && formData.crypto_amount && marketPriceLocal > 0) {
      setFiatAmount((parseFloat(formData.crypto_amount) * marketPriceLocal).toFixed(2));
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
                onClick={() => {
                  updateFormData({ crypto_type: crypto.symbol, crypto_amount: "" });
                  setFiatAmount("");
                }}
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
            onClick={() => refetchPrices()}
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

      {/* Input Mode Toggle */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
          <button
            type="button"
            onClick={() => handleModeSwitch("crypto")}
            className={cn(
              "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
              inputMode === "crypto"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Enter {formData.crypto_type}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("fiat")}
            className={cn(
              "flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all",
              inputMode === "fiat"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Enter {formData.fiat_currency}
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            {inputMode === "crypto" 
              ? `Amount to ${formData.type} (${formData.crypto_type})`
              : `Amount in ${formData.fiat_currency}`
            }
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

        {inputMode === "crypto" ? (
          <Input
            type="number"
            step="any"
            placeholder="0.00000000"
            value={formData.crypto_amount}
            onChange={(e) => handleCryptoAmountChange(e.target.value)}
            className={cn(
              "h-12 text-lg font-mono",
              hasInsufficientBalance && "border-destructive focus-visible:ring-destructive"
            )}
          />
        ) : (
          <Input
            type="number"
            step="any"
            placeholder="0.00"
            value={fiatAmount}
            onChange={(e) => handleFiatAmountChange(e.target.value)}
            className={cn(
              "h-12 text-lg font-mono",
              hasInsufficientBalance && "border-destructive focus-visible:ring-destructive"
            )}
          />
        )}

        {hasInsufficientBalance && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Amount exceeds available balance
          </p>
        )}

        {/* Conversion display */}
        {formData.crypto_amount && !hasInsufficientBalance && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Crypto Amount:</span>
              <span className="font-mono font-medium">{parseFloat(formData.crypto_amount).toFixed(8)} {formData.crypto_type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fiat Value:</span>
              <span className="font-mono font-medium">{formatCurrency(parseFloat(formData.crypto_amount) * marketPriceLocal, formData.fiat_currency)}</span>
            </div>
          </div>
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