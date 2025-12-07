import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";

interface MarketplaceFiltersProps {
  onFilterChange?: (filters: {
    type: "buy" | "sell" | "all";
    crypto: string;
    paymentMethod: string;
    amount: string;
  }) => void;
}

const cryptos = ["All", "BTC", "USDT", "ETH", "BNB"];
const paymentMethods = ["All", "MPESA", "Bank Transfer", "Airtel Money"];

const MarketplaceFilters = ({ onFilterChange }: MarketplaceFiltersProps) => {
  const [type, setType] = useState<"buy" | "sell" | "all">("all");
  const [selectedCrypto, setSelectedCrypto] = useState("All");
  const [selectedPayment, setSelectedPayment] = useState("All");
  const [amount, setAmount] = useState("");

  return (
    <div className="glass-card mb-8">
      {/* Trade Type Toggle */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={type === "buy" ? "buy" : "secondary"}
          className="flex-1"
          onClick={() => setType("buy")}
        >
          Buy Crypto
        </Button>
        <Button
          variant={type === "sell" ? "sell" : "secondary"}
          className="flex-1"
          onClick={() => setType("sell")}
        >
          Sell Crypto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Crypto Filter */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Cryptocurrency</label>
          <div className="flex flex-wrap gap-2">
            {cryptos.map((crypto) => (
              <Button
                key={crypto}
                size="sm"
                variant={selectedCrypto === crypto ? "default" : "secondary"}
                onClick={() => setSelectedCrypto(crypto)}
              >
                {crypto}
              </Button>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Payment Method</label>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.slice(0, 3).map((method) => (
              <Button
                key={method}
                size="sm"
                variant={selectedPayment === method ? "default" : "secondary"}
                onClick={() => setSelectedPayment(method)}
              >
                {method}
              </Button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Amount (KES)</label>
          <Input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Search Button */}
        <div className="flex items-end">
          <Button variant="hero" className="w-full">
            <Search className="w-4 h-4 mr-2" />
            Search Offers
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceFilters;
