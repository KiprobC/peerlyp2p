import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Shield, Star, AlertTriangle, Globe } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useEscrow } from "@/hooks/useEscrow";
import { useAuth } from "@/contexts/AuthContext";
import { OfferWithProfile } from "@/hooks/useOffers";
import { toast } from "sonner";

interface InitiateTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: OfferWithProfile | null;
  isOutsideRegion?: boolean;
  userCurrency?: string | null;
}

const InitiateTradeDialog = ({ open, onOpenChange, offer, isOutsideRegion, userCurrency }: InitiateTradeDialogProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createTrade, updateTrade } = useTrades();
  const { lockEscrow } = useEscrow();
  const [loading, setLoading] = useState(false);
  const [fiatAmount, setFiatAmount] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [showRegionWarning, setShowRegionWarning] = useState(false);

  if (!offer) return null;

  const cryptoAmount = fiatAmount ? parseFloat(fiatAmount) / offer.price_per_unit : 0;
  const isBuyOffer = offer.type === "buy";
  const isValidAmount = 
    parseFloat(fiatAmount) >= offer.min_amount && 
    parseFloat(fiatAmount) <= offer.max_amount;

  const handleTrade = async () => {
    if (!user || !offer) return;

    if (!fiatAmount || !selectedPayment) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!isValidAmount) {
      toast.error(`Amount must be between KES ${offer.min_amount.toLocaleString()} and KES ${offer.max_amount.toLocaleString()}`);
      return;
    }

    setLoading(true);

    try {
      // For a BUY offer, the offer creator is buying, so they're the buyer
      // The person responding to the offer is selling, so they're the seller
      const buyer_id = isBuyOffer ? offer.user_id : user.id;
      const seller_id = isBuyOffer ? user.id : offer.user_id;
      const calculatedCryptoAmount = parseFloat(fiatAmount) / offer.price_per_unit;

      // Step 1: Create the trade FIRST to get a real UUID
      const { error, data: tradeData } = await createTrade({
        offer_id: offer.id,
        buyer_id,
        seller_id,
        crypto_type: offer.crypto_type,
        crypto_amount: calculatedCryptoAmount,
        fiat_amount: parseFloat(fiatAmount),
        fiat_currency: offer.fiat_currency,
        payment_method: selectedPayment,
      });

      if (error || !tradeData) {
        throw error || new Error("Failed to create trade");
      }

      // Step 2: Lock escrow using the real trade UUID
      const escrowResult = await lockEscrow(
        seller_id,
        offer.crypto_type,
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
      toast.error(error.message || "Failed to initiate trade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isBuyOffer ? "Sell" : "Buy"} {offer.crypto_type}
          </DialogTitle>
          <DialogDescription>
            Trading with {offer.trader_name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Trader Info */}
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {offer.trader_name?.charAt(0) || "?"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{offer.trader_name}</span>
                  {offer.trader_verified && <Shield className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="w-3 h-3 text-accent fill-accent" />
                  <span>{offer.trader_rating?.toFixed(1)}</span>
                  <span>•</span>
                  <span>{offer.trader_trades} trades</span>
                </div>
              </div>
            </div>

            {/* Price Info */}
            <div className="p-3 bg-secondary/50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Price</span>
                <span className="font-semibold">
                  KES {offer.price_per_unit.toLocaleString()} / {offer.crypto_type}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Limit</span>
                <span>
                  KES {offer.min_amount.toLocaleString()} - {offer.max_amount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label>Amount (KES)</Label>
              <Input
                type="number"
                placeholder={`${offer.min_amount} - ${offer.max_amount}`}
                value={fiatAmount}
                onChange={(e) => setFiatAmount(e.target.value)}
              />
              {fiatAmount && (
                <p className="text-sm text-muted-foreground">
                  You will {isBuyOffer ? "receive" : "get"}{" "}
                  <span className="font-semibold text-foreground">
                    {cryptoAmount.toFixed(offer.crypto_type === "USDT" ? 2 : 6)} {offer.crypto_type}
                  </span>
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
                  {offer.payment_methods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Terms */}
            {offer.terms && (
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Trader's Terms:</p>
                <p className="text-sm">{offer.terms}</p>
              </div>
            )}

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-accent/10 border border-accent/30 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                Once you initiate this trade, the seller's crypto will be locked in escrow. 
                Complete the payment within {offer.time_limit} minutes.
              </p>
            </div>

            {/* Cross-Region Warning Banner */}
            {isOutsideRegion && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                <Globe className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-500">Cross-region offer</p>
                  <p className="text-muted-foreground">
                    This offer uses {offer.fiat_currency || "a different currency"} payment methods which may differ from your region ({userCurrency || "your currency"}).
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
              disabled={loading || !isValidAmount || !selectedPayment}
            >
              {loading ? "Processing..." : `${isBuyOffer ? "Sell" : "Buy"} ${offer.crypto_type}`}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>

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
                You're about to trade with an offer from a <strong>different region</strong> ({offer.fiat_currency}).
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
    </Dialog>
  );
};

export default InitiateTradeDialog;
