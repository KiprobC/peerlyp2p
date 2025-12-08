import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface MarketplaceFiltersProps {
  onFilterChange: (filters: {
    type: "buy" | "sell" | null;
    crypto: string;
    paymentMethod: string;
    amount: string;
  }) => void;
  initialFilters?: {
    type: "buy" | "sell" | null;
    crypto: string;
    paymentMethod: string;
    amount: string;
  };
}

const cryptos = ["All", "BTC", "USDT", "ETH"];
const paymentMethods = ["All", "MPESA", "Bank Transfer", "Airtel Money"];

const MarketplaceFilters = ({ onFilterChange, initialFilters }: MarketplaceFiltersProps) => {
  const [type, setType] = useState<"buy" | "sell" | null>(initialFilters?.type || null);
  const [selectedCrypto, setSelectedCrypto] = useState(initialFilters?.crypto || "All");
  const [selectedPayment, setSelectedPayment] = useState(initialFilters?.paymentMethod || "All");
  const [amount, setAmount] = useState(initialFilters?.amount || "");

  useEffect(() => {
    onFilterChange({
      type,
      crypto: selectedCrypto,
      paymentMethod: selectedPayment,
      amount,
    });
  }, [type, selectedCrypto, selectedPayment]);

  const handleSearch = () => {
    onFilterChange({
      type,
      crypto: selectedCrypto,
      paymentMethod: selectedPayment,
      amount,
    });
  };

  return (
    <div className="glass-card mb-8">
      {/* Trade Type Toggle */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={type === "sell" ? "default" : "secondary"}
          className="flex-1"
          onClick={() => setType(type === "sell" ? null : "sell")}
        >
          Buy Crypto
        </Button>
        <Button
          variant={type === "buy" ? "default" : "secondary"}
          className="flex-1"
          onClick={() => setType(type === "buy" ? null : "buy")}
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
          <Button variant="default" className="w-full" onClick={handleSearch}>
            <Search className="w-4 h-4 mr-2" />
            Search Offers
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceFilters;
