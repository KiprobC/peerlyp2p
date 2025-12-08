import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useMyOffers } from "@/hooks/useOffers";
import { toast } from "sonner";

const cryptoOptions = ["BTC", "USDT", "ETH"];
const paymentMethodOptions = ["MPESA", "Bank Transfer", "Airtel Money"];

const CreateOffer = () => {
  const navigate = useNavigate();
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
      navigate("/marketplace");
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

  const totalValue = formData.crypto_amount && formData.price_per_unit
    ? (parseFloat(formData.crypto_amount) * parseFloat(formData.price_per_unit)).toLocaleString()
    : "0";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold ml-2">Create Offer</h1>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Offer Type */}
            <div className="glass-card">
              <Label className="text-base font-semibold mb-4 block">What do you want to do?</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  size="lg"
                  variant={formData.type === "sell" ? "default" : "secondary"}
                  onClick={() => setFormData((prev) => ({ ...prev, type: "sell" }))}
                  className="h-16"
                >
                  <div className="text-center">
                    <div className="font-semibold">Sell Crypto</div>
                    <div className="text-xs opacity-80">Receive KES</div>
                  </div>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant={formData.type === "buy" ? "default" : "secondary"}
                  onClick={() => setFormData((prev) => ({ ...prev, type: "buy" }))}
                  className="h-16"
                >
                  <div className="text-center">
                    <div className="font-semibold">Buy Crypto</div>
                    <div className="text-xs opacity-80">Pay with KES</div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Crypto Details */}
            <div className="glass-card space-y-4">
              <Label className="text-base font-semibold">Cryptocurrency</Label>
              <Select
                value={formData.crypto_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, crypto_type: value }))
                }
              >
                <SelectTrigger className="h-12">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
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

              {formData.crypto_amount && formData.price_per_unit && (
                <div className="p-3 bg-primary/10 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-xl font-bold text-primary">KES {totalValue}</p>
                </div>
              )}
            </div>

            {/* Trade Limits */}
            <div className="glass-card space-y-4">
              <Label className="text-base font-semibold">Trade Limits (KES)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum</Label>
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
                  <Label>Maximum</Label>
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
            </div>

            {/* Payment Methods */}
            <div className="glass-card space-y-4">
              <Label className="text-base font-semibold">Accepted Payment Methods</Label>
              <div className="flex flex-wrap gap-2">
                {paymentMethodOptions.map((method) => (
                  <Button
                    key={method}
                    type="button"
                    variant={formData.payment_methods.includes(method) ? "default" : "secondary"}
                    onClick={() => togglePaymentMethod(method)}
                  >
                    {method}
                  </Button>
                ))}
              </div>
            </div>

            {/* Time Limit */}
            <div className="glass-card space-y-4">
              <Label className="text-base font-semibold">Payment Time Limit</Label>
              <Select
                value={formData.time_limit}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, time_limit: value }))
                }
              >
                <SelectTrigger className="h-12">
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
            <div className="glass-card space-y-4">
              <Label className="text-base font-semibold">Terms & Conditions (Optional)</Label>
              <Textarea
                placeholder="Any specific requirements for trading with you..."
                value={formData.terms}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, terms: e.target.value }))
                }
                rows={4}
              />
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? "Creating Offer..." : "Create Offer"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default CreateOffer;
