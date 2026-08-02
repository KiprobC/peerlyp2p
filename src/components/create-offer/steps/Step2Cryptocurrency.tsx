import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Wallet, AlertTriangle, RefreshCw, Lock, TrendingUp, Check } from "lucide-react";
import { StepProps } from "../types";
import { useAvailableBalance } from "@/hooks/useAvailableBalance";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { useCurrencyConversion } from "@/hooks/useCountries";
import { cn } from "@/lib/utils";
import { formatCryptoBalance, formatExact, formatFiatPrice } from "@/lib/formatNumber";

const CRYPTO_OPTIONS = [
  { symbol: "BTC", name: "Bitcoin", icon: "₿", color: "text-orange-500", bgColor: "bg-orange-500/10", ring: "ring-orange-500/40" },
  { symbol: "ETH", name: "Ethereum", icon: "Ξ", color: "text-blue-500", bgColor: "bg-blue-500/10", ring: "ring-blue-500/40" },
  { symbol: "USDT", name: "Tether", icon: "$", color: "text-green-500", bgColor: "bg-green-500/10", ring: "ring-green-500/40" },
];

type InputMode = "crypto" | "fiat";

const BalanceStat = ({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone?: string;
  icon?: React.ReactNode;
}) => (
  <div className="min-w-0 rounded-lg bg-background/60 px-2 py-2.5 sm:px-3">
    <p className="mb-1 flex items-center justify-center gap-1 truncate text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">
      {icon}
      {label}
    </p>
    <p
      title={formatExact(value)}
      className={cn(
        "truncate text-center font-mono text-[13px] font-semibold leading-tight tabular-nums sm:text-sm",
        tone
      )}
    >
      {formatCryptoBalance(value)}
    </p>
  </div>
);

export const Step2Cryptocurrency = ({ formData, updateFormData, onNext, onBack }: StepProps) => {
  const { getAvailableBalance, getBalanceDetails, refetch: refetchBalance, loading: balanceLoading } = useAvailableBalance();
  const { prices, loading: pricesLoading, refetch: refetchPrices } = useCryptoPrices("USD");
  const { convert, formatCurrency } = useCurrencyConversion();

  const [inputMode, setInputMode] = useState<InputMode>("crypto");
  const [fiatAmount, setFiatAmount] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isSellOffer = formData.type === "sell";
  const availableBalance = getAvailableBalance(formData.crypto_type);
  const balanceDetails = getBalanceDetails(formData.crypto_type);
  const enteredAmount = parseFloat(formData.crypto_amount || "0");
  const hasInsufficientBalance = isSellOffer && enteredAmount > availableBalance;
  const marketPriceUSD = prices[formData.crypto_type] || 0;
  const marketPriceLocal = convert(marketPriceUSD, "USD", formData.fiat_currency);
  const showsLocalEquivalent =
    formData.fiat_currency && formData.fiat_currency !== "USD" && marketPriceUSD > 0;

  useEffect(() => {
    if (!pricesLoading && marketPriceUSD > 0) setLastUpdated(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricesLoading, marketPriceUSD]);

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
    if (mode === "fiat" && formData.crypto_amount && marketPriceLocal > 0) {
      setFiatAmount((parseFloat(formData.crypto_amount) * marketPriceLocal).toFixed(2));
    }
  };

  const updatedLabel = pricesLoading
    ? "Updating…"
    : lastUpdated
      ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "Awaiting price feed";

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
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {CRYPTO_OPTIONS.map((crypto) => {
            const isSelected = formData.crypto_type === crypto.symbol;
            const assetBalance = getAvailableBalance(crypto.symbol);
            return (
              <button
                key={crypto.symbol}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  updateFormData({ crypto_type: crypto.symbol, crypto_amount: "" });
                  setFiatAmount("");
                }}
                className={cn(
                  "group relative min-w-0 overflow-hidden rounded-2xl border p-3 text-center sm:p-4",
                  "transition-all duration-200 ease-out will-change-transform",
                  "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98]",
                  isSelected
                    ? cn("border-primary/70 ring-2 ring-inset shadow-md", crypto.bgColor, crypto.ring)
                    : "border-border/70 bg-card hover:border-muted-foreground/40"
                )}
              >
                {isSelected && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
                <div
                  className={cn(
                    "mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold transition-transform duration-200 group-hover:scale-105",
                    crypto.bgColor,
                    crypto.color
                  )}
                >
                  {crypto.icon}
                </div>
                <p className="truncate text-sm font-semibold tracking-tight">{crypto.symbol}</p>
                <p className="truncate text-[11px] text-muted-foreground">{crypto.name}</p>
                {isSellOffer && (
                  <p
                    title={formatExact(assetBalance)}
                    className={cn(
                      "mt-1.5 truncate font-mono text-[10px] tabular-nums",
                      assetBalance > 0 ? "text-green-500" : "text-muted-foreground/70"
                    )}
                  >
                    {formatCryptoBalance(assetBalance)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Market Price */}
      <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm font-medium">
              Market Price · {formData.crypto_type}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetchPrices()}
            disabled={pricesLoading}
            className="h-7 shrink-0 px-2"
            aria-label="Refresh market price"
          >
            <RefreshCw className={cn("h-3 w-3", pricesLoading && "animate-spin")} />
          </Button>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="break-all text-2xl font-bold tabular-nums leading-tight">
            {formatFiatPrice(marketPriceLocal, formData.fiat_currency)}
          </span>
          <span className="text-sm text-muted-foreground">per {formData.crypto_type}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {showsLocalEquivalent ? (
            <span className="tabular-nums">≈ {formatFiatPrice(marketPriceUSD, "USD")}</span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                pricesLoading ? "bg-yellow-500 animate-pulse" : "bg-green-500"
              )}
            />
            {updatedLabel}
          </span>
        </div>
      </div>

      {/* Balance Info (Sell offers only) */}
      {isSellOffer && (
        <div
          className={cn(
            "space-y-3 rounded-2xl border p-4",
            hasInsufficientBalance
              ? "border-destructive/30 bg-destructive/10"
              : "border-primary/30 bg-primary/5"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Wallet className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">
                Your {formData.crypto_type} Balance
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={refetchBalance}
              disabled={balanceLoading}
              className="h-7 shrink-0 px-2"
              aria-label="Refresh balance"
            >
              <RefreshCw className={cn("h-3 w-3", balanceLoading && "animate-spin")} />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <BalanceStat label="Total" value={balanceDetails?.total_balance || 0} />
            <BalanceStat
              label="In Use"
              icon={<Lock className="h-2.5 w-2.5 shrink-0" />}
              value={(balanceDetails?.locked_balance || 0) + (balanceDetails?.reserved_balance || 0)}
              tone="text-yellow-500"
            />
            <BalanceStat label="Available" value={availableBalance} tone="text-green-500" />
          </div>

          {marketPriceLocal > 0 && availableBalance > 0 && (
            <p className="text-center text-[11px] text-muted-foreground">
              Available ≈ {formatFiatPrice(availableBalance * marketPriceLocal, formData.fiat_currency)}
            </p>
          )}

          {availableBalance <= 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/20 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
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
              "flex-1 truncate rounded-md px-3 py-2 text-sm font-medium transition-all",
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
              "flex-1 truncate rounded-md px-3 py-2 text-sm font-medium transition-all",
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-sm font-medium">
            {inputMode === "crypto"
              ? `Amount to ${formData.type} (${formData.crypto_type})`
              : `Amount in ${formData.fiat_currency}`}
          </Label>
          {isSellOffer && availableBalance > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto max-w-[55%] p-0 text-xs text-primary"
              onClick={handleUseMax}
            >
              <span className="truncate">Use Max ({formatCryptoBalance(availableBalance)})</span>
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
          <div className="space-y-1 rounded-lg bg-muted/50 p-3">
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="shrink-0 text-muted-foreground">Crypto Amount:</span>
              <span className="min-w-0 break-all text-right font-mono font-medium">
                {parseFloat(formData.crypto_amount).toFixed(8)} {formData.crypto_type}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="shrink-0 text-muted-foreground">Fiat Value:</span>
              <span className="min-w-0 break-all text-right font-mono font-medium">
                {formatCurrency(parseFloat(formData.crypto_amount) * marketPriceLocal, formData.fiat_currency)}
              </span>
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
