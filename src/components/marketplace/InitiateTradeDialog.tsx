import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Star, AlertTriangle, Globe, AlertCircle, RefreshCw } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useEscrow } from "@/hooks/useEscrow";
import { useAuth } from "@/contexts/AuthContext";
import { OfferWithProfile } from "@/hooks/useOffers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InitiateTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: OfferWithProfile | null;
  isOutsideRegion?: boolean;
  userCurrency?: string | null;
}

// Loading state component
const DialogLoadingState = () => (
  <div className="space-y-4 p-4">
    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <Skeleton className="h-20 w-full rounded-lg" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

// Error state component
const DialogErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
      <AlertCircle className="w-6 h-6 text-destructive" />
    </div>
    <h3 className="font-semibold text-lg mb-2">Unable to Load Offer</h3>
    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
      {message}
    </p>
    {onRetry && (
      <Button onClick={onRetry} variant="outline" size="sm">
        <RefreshCw className="w-4 h-4 mr-2" />
        Try Again
      </Button>
    )}
  </div>
);

// Empty/Not Found state component
const DialogNotFoundState = ({ onClose }: { onClose: () => void }) => (
  <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
      <AlertTriangle className="w-6 h-6 text-muted-foreground" />
    </div>
    <h3 className="font-semibold text-lg mb-2">Offer Not Found</h3>
    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
      This offer may have been removed or is no longer available.
    </p>
    <Button onClick={onClose} variant="outline" size="sm">
      Close
    </Button>
  </div>
);

const InitiateTradeDialog = ({ open, onOpenChange, offer, isOutsideRegion, userCurrency }: InitiateTradeDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createTrade, updateTrade } = useTrades();
  const { lockEscrow } = useEscrow();
  const [loading, setLoading] = useState(false);
  const [fiatAmount, setFiatAmount] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [showRegionWarning, setShowRegionWarning] = useState(false);
  const [maxTradeAmount, setMaxTradeAmount] = useState<number | null>(null);
  const [escrowValidated, setEscrowValidated] = useState(false);
  const [escrowValidating, setEscrowValidating] = useState(false);
  const [escrowError, setEscrowError] = useState<string | null>(null);

  // Reset state when dialog opens/closes or offer changes
  useEffect(() => {
    if (open) {
      setFiatAmount("");
      setSelectedPayment("");
      setEscrowError(null);
    }
  }, [open, offer?.id]);

  // Safe access to offer properties with optional chaining
  const offerId = offer?.id;
  const offerType = offer?.type;
  const cryptoType = offer?.crypto_type;
  const pricePerUnit = offer?.price_per_unit ?? 0;
  const minAmount = offer?.min_amount ?? 0;
  const maxAmount = offer?.max_amount ?? 0;
  const paymentMethods = offer?.payment_methods ?? [];
  const traderName = offer?.trader_name ?? "Unknown Trader";
  const traderVerified = offer?.trader_verified ?? false;
  const traderRating = offer?.trader_rating ?? 0;
  const traderTrades = offer?.trader_trades ?? 0;
  const timeLimit = offer?.time_limit ?? 30;
  const terms = offer?.terms;
  const fiatCurrency = offer?.fiat_currency ?? "KES";

  const cryptoAmount = fiatAmount && pricePerUnit > 0 ? parseFloat(fiatAmount) / pricePerUnit : 0;
  const isBuyOffer = offerType === "buy";
  
  // For sell offers (user is buying), check if trade amount exceeds seller's available escrow
  const maxCryptoFromOffer = (offer as any)?.reserved_amount ?? offer?.crypto_amount ?? 0;
  const maxFiatFromOffer = maxCryptoFromOffer * pricePerUnit;
  
  const parsedFiatAmount = parseFloat(fiatAmount) || 0;
  const isValidAmount = 
    parsedFiatAmount >= minAmount && 
    parsedFiatAmount <= Math.min(maxAmount, maxFiatFromOffer);
  
  const exceedsSellerBalance = !isBuyOffer && cryptoAmount > maxCryptoFromOffer;

  // Validate escrow when dialog opens for sell offers
  useEffect(() => {
    const validateEscrow = async () => {
      if (!offer || !offerId || isBuyOffer) {
        setEscrowValidated(true);
        setEscrowValidating(false);
        return;
      }
      
      setEscrowValidating(true);
      setEscrowError(null);
      
      try {
        const { data, error } = await (supabase.rpc as any)("validate_trade_escrow", {
          p_offer_id: offerId,
          p_trade_amount: offer.crypto_amount ?? 0,
        });
        
        if (error) {
          console.error("Error validating escrow:", error);
          // Don't block the UI, just log the error
          setEscrowValidated(true);
          return;
        }
        
        const result = data as { success: boolean; max_trade_amount?: number; error?: string } | null;
        if (result?.max_trade_amount !== undefined) {
          setMaxTradeAmount(result.max_trade_amount);
        }
        if (result?.error) {
          setEscrowError(result.error);
        }
        setEscrowValidated(result?.success ?? true);
      } catch (error) {
        console.error("Error validating escrow:", error);
        // Don't block the UI on validation errors
        setEscrowValidated(true);
      } finally {
        setEscrowValidating(false);
      }
    };
    
    if (open && offer && offerId) {
      validateEscrow();
    }
  }, [open, offerId, offer?.crypto_amount, isBuyOffer]);

  const handleTrade = async () => {
    if (!user || !offer || !offerId) return;

    if (!fiatAmount || !selectedPayment) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!isValidAmount) {
      toast.error(`Amount must be between ${fiatCurrency} ${minAmount.toLocaleString()} and ${fiatCurrency} ${maxAmount.toLocaleString()}`);
      return;
    }

    setLoading(true);

    try {
      // For a BUY offer, the offer creator is buying, so they're the buyer
      // The person responding to the offer is selling, so they're the seller
      const buyer_id = isBuyOffer ? offer.user_id : user.id;
      const seller_id = isBuyOffer ? user.id : offer.user_id;
      const calculatedCryptoAmount = parsedFiatAmount / pricePerUnit;

      // Step 1: Create the trade FIRST to get a real UUID
      const { error, data: tradeData } = await createTrade({
        offer_id: offerId,
        buyer_id,
        seller_id,
        crypto_type: cryptoType || "BTC",
        crypto_amount: calculatedCryptoAmount,
        fiat_amount: parsedFiatAmount,
        fiat_currency: fiatCurrency,
        payment_method: selectedPayment,
      });

      if (error || !tradeData) {
        throw error || new Error("Failed to create trade");
      }

      // Step 2: Lock escrow using the real trade UUID
      const escrowResult = await lockEscrow(
        seller_id,
        cryptoType || "BTC",
        calculatedCryptoAmount,
        tradeData.id // Use real trade UUID
      );

      if (!escrowResult.success) {
        // Escrow failed - cancel the trade
        await updateTrade(tradeData.id, {
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user.id,
        });
        toast.error(escrowResult.error || "Seller has insufficient balance for escrow");
        setLoading(false);
        return;
      }

      // Step 3: Update trade to mark escrow as locked and confirmed
      await updateTrade(tradeData.id, {
        escrow_locked: true,
        status: "confirmed",
      });

      toast.success("Trade initiated! Crypto is now locked in escrow.");
      onOpenChange(false);
      navigate(`/trade/${tradeData.id}`);
    } catch (error: any) {
      console.error("Trade initiation error:", error);
      toast.error(error?.message || "Failed to initiate trade");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  // Render dialog with proper states
  const renderDialogContent = () => {
    // Loading state - when escrow is being validated
    if (escrowValidating) {
      return <DialogLoadingState />;
    }

    // Offer not found state
    if (!offer || !offerId) {
      return <DialogNotFoundState onClose={handleClose} />;
    }

    // Escrow error state (optional - you might want to show a warning instead)
    if (escrowError && !escrowValidated) {
      return (
        <DialogErrorState 
          message={escrowError} 
          onRetry={() => {
            setEscrowError(null);
            setEscrowValidated(false);
          }} 
        />
      );
    }

    // Main content
    return (
      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4">
          {/* Trader Info */}
          <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {traderName?.charAt(0) || "?"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{traderName}</span>
                {traderVerified && <Shield className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="w-3 h-3 text-accent fill-accent" />
                <span>{traderRating?.toFixed(1) ?? "0.0"}</span>
                <span>•</span>
                <span>{traderTrades ?? 0} trades</span>
              </div>
            </div>
          </div>

          {/* Price Info */}
          <div className="p-3 bg-secondary/50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted-foreground">Price</span>
              <span className="font-semibold">
                {fiatCurrency} {pricePerUnit.toLocaleString()} / {cryptoType || "CRYPTO"}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Limit</span>
              <span>
                {fiatCurrency} {minAmount.toLocaleString()} - {maxAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label>Amount ({fiatCurrency})</Label>
            <Input
              type="number"
              placeholder={`${minAmount} - ${maxAmount}`}
              value={fiatAmount}
              onChange={(e) => setFiatAmount(e.target.value)}
              min={minAmount}
              max={Math.min(maxAmount, maxFiatFromOffer)}
            />
            {fiatAmount && parsedFiatAmount > 0 && (
              <p className="text-sm text-muted-foreground">
                You will {isBuyOffer ? "receive" : "get"}{" "}
                <span className="font-semibold text-foreground">
                  {cryptoAmount.toFixed(cryptoType === "USDT" ? 2 : 6)} {cryptoType || "CRYPTO"}
                </span>
              </p>
            )}
            {exceedsSellerBalance && (
              <p className="text-sm text-destructive">
                Amount exceeds seller's available balance
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={selectedPayment} onValueChange={setSelectedPayment}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.length > 0 ? (
                  paymentMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled>
                    No payment methods available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Terms */}
          {terms && (
            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Trader's Terms:</p>
              <p className="text-sm">{terms}</p>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-accent/10 border border-accent/30 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <p className="text-muted-foreground">
              Once you initiate this trade, the seller's crypto will be locked in escrow. 
              Complete the payment within {timeLimit} minutes.
            </p>
          </div>

          {/* Cross-Region Warning Banner */}
          {isOutsideRegion && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
              <Globe className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-500">Cross-region offer</p>
                <p className="text-muted-foreground">
                  This offer uses {fiatCurrency || "a different currency"} payment methods which may differ from your region ({userCurrency || "your currency"}).
                </p>
              </div>
            </div>
          )}

          {/* Action Button */}
          <Button
            className="w-full"
            onClick={() => {
              if (isOutsideRegion) {
                setShowRegionWarning(true);
              } else {
                handleTrade();
              }
            }}
            disabled={loading || !isValidAmount || !selectedPayment || exceedsSellerBalance}
          >
            {loading ? "Processing..." : `${isBuyOffer ? "Sell" : "Buy"} ${cryptoType || "CRYPTO"}`}
          </Button>
        </div>
      </ScrollArea>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {offer ? `${isBuyOffer ? "Sell" : "Buy"} ${cryptoType || "Crypto"}` : "Trade Details"}
            </DialogTitle>
            <DialogDescription>
              {offer ? `Trading with ${traderName}` : "Loading offer details..."}
            </DialogDescription>
          </DialogHeader>

          {renderDialogContent()}
        </DialogContent>
      </Dialog>

      {/* Cross-Region Warning Dialog */}
      <AlertDialog open={showRegionWarning} onOpenChange={setShowRegionWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-500" />
              Cross-Region Trade Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You're about to trade with an offer from a <strong>different region</strong> ({fiatCurrency}).
              </p>
              <div className="bg-secondary/50 p-3 rounded-lg space-y-2 text-sm">
                <p className="font-medium text-foreground">Please be aware:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Payment methods may not be available in your region</li>
                  <li>Currency conversion fees may apply from your bank</li>
                  <li>International transfers may take longer to process</li>
                  <li>The trader may have different banking hours</li>
                </ul>
              </div>
              <p className="text-sm">
                Are you sure you want to proceed with this cross-region trade?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowRegionWarning(false);
                handleTrade();
              }}
            >
              Proceed with Trade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InitiateTradeDialog;
