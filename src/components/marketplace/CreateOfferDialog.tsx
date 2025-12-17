import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyOffers } from "@/hooks/useOffers";
import { toast } from "sonner";

interface CreateOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const cryptoOptions = ["BTC", "USDT", "ETH"];
const paymentMethodOptions = ["MPESA", "Bank Transfer", "Airtel Money"];

const CreateOfferDialog = ({ open, onOpenChange }: CreateOfferDialogProps) => {
  const { createOffer } = useMyOffers();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "sell" as "buy" | "sell",
    crypto_type: "BTC",
    crypto_amount: "",
    price_per_unit: "",
    min_amount: "",
    max_amount: "",
    payment_methods: ["MPESA"],
    time_limit: "30",
    terms: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await createOffer({
        type: formData.type,
        crypto_type: formData.crypto_type,
        crypto_amount: parseFloat(formData.crypto_amount),
        price_per_unit: parseFloat(formData.price_per_unit),
        price_margin: 0,
        min_amount: parseFloat(formData.min_amount),
        max_amount: parseFloat(formData.max_amount),
        payment_methods: formData.payment_methods,
        time_limit: parseInt(formData.time_limit),
        terms: formData.terms || null,
        is_active: true,
        fiat_currency: "KES",
      });

      if (error) throw error;

      toast.success("Offer created successfully!");
      onOpenChange(false);
      setFormData({
        type: "sell",
        crypto_type: "BTC",
        crypto_amount: "",
        price_per_unit: "",
        min_amount: "",
        max_amount: "",
        payment_methods: ["MPESA"],
        time_limit: "30",
        terms: "",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create offer");
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentMethod = (method: string) => {
    setFormData((prev) => ({
      ...prev,
      payment_methods: prev.payment_methods.includes(method)
        ? prev.payment_methods.filter((m) => m !== method)
        : [...prev.payment_methods, method],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Offer</DialogTitle>
          <DialogDescription>
            Set up your buy or sell offer for other traders
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Offer Type */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={formData.type === "sell" ? "default" : "secondary"}
              onClick={() => setFormData((prev) => ({ ...prev, type: "sell" }))}
            >
              I want to Sell
            </Button>
            <Button
              type="button"
              variant={formData.type === "buy" ? "default" : "secondary"}
              onClick={() => setFormData((prev) => ({ ...prev, type: "buy" }))}
            >
              I want to Buy
            </Button>
          </div>

          {/* Crypto Type */}
          <div className="space-y-2">
            <Label>Cryptocurrency</Label>
            <Select
              value={formData.crypto_type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, crypto_type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cryptoOptions.map((crypto) => (
                  <SelectItem key={crypto} value={crypto}>
                    {crypto}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount & Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount ({formData.crypto_type})</Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={formData.crypto_amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, crypto_amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Price per unit (KES)</Label>
              <Input
                type="number"
                placeholder="0"
                value={formData.price_per_unit}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, price_per_unit: e.target.value }))
                }
                required
              />
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Amount (KES)</Label>
              <Input
                type="number"
                placeholder="1000"
                value={formData.min_amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, min_amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Max Amount (KES)</Label>
              <Input
                type="number"
                placeholder="100000"
                value={formData.max_amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, max_amount: e.target.value }))
                }
                required
              />
            </div>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2">
            <Label>Payment Methods</Label>
            <div className="flex flex-wrap gap-2">
              {paymentMethodOptions.map((method) => (
                <Button
                  key={method}
                  type="button"
                  size="sm"
                  variant={formData.payment_methods.includes(method) ? "default" : "secondary"}
                  onClick={() => togglePaymentMethod(method)}
                >
                  {method}
                </Button>
              ))}
            </div>
          </div>

          {/* Time Limit */}
          <div className="space-y-2">
            <Label>Payment Time Limit</Label>
            <Select
              value={formData.time_limit}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, time_limit: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Terms */}
          <div className="space-y-2">
            <Label>Terms & Conditions (Optional)</Label>
            <Textarea
              placeholder="Any specific requirements for trading..."
              value={formData.terms}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, terms: e.target.value }))
              }
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Offer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOfferDialog;
