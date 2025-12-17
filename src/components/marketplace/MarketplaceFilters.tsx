import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Search, Filter, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface MarketplaceFiltersProps {
  onFilterChange: (filters: {
    type: "buy" | "sell" | null;
    crypto: string;
    paymentMethod: string;
    amount: string;
    minRating: number;
    onlineOnly: boolean;
    minPrice: string;
    maxPrice: string;
  }) => void;
  initialFilters?: {
    type: "buy" | "sell" | null;
    crypto: string;
    paymentMethod: string;
    amount: string;
    minRating?: number;
    onlineOnly?: boolean;
    minPrice?: string;
    maxPrice?: string;
  };
}

const cryptos = ["All", "BTC", "USDT", "ETH"];
const paymentMethods = ["All", "MPESA", "Bank Transfer", "Airtel Money"];

const MarketplaceFilters = ({ onFilterChange, initialFilters }: MarketplaceFiltersProps) => {
  const [type, setType] = useState<"buy" | "sell" | null>(initialFilters?.type || null);
  const [selectedCrypto, setSelectedCrypto] = useState(initialFilters?.crypto || "All");
  const [selectedPayment, setSelectedPayment] = useState(initialFilters?.paymentMethod || "All");
  const [amount, setAmount] = useState(initialFilters?.amount || "");
  const [minRating, setMinRating] = useState(initialFilters?.minRating || 0);
  const [onlineOnly, setOnlineOnly] = useState(initialFilters?.onlineOnly || false);
  const [minPrice, setMinPrice] = useState(initialFilters?.minPrice || "");
  const [maxPrice, setMaxPrice] = useState(initialFilters?.maxPrice || "");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    onFilterChange({
      type,
      crypto: selectedCrypto,
      paymentMethod: selectedPayment,
      amount,
      minRating,
      onlineOnly,
      minPrice,
      maxPrice,
    });
  }, [type, selectedCrypto, selectedPayment, amount, minRating, onlineOnly, minPrice, maxPrice]);

  const handleSearch = () => {
    onFilterChange({
      type,
      crypto: selectedCrypto,
      paymentMethod: selectedPayment,
      amount,
      minRating,
      onlineOnly,
      minPrice,
      maxPrice,
    });
  };

  const clearFilters = () => {
    setType(null);
    setSelectedCrypto("All");
    setSelectedPayment("All");
    setAmount("");
    setMinRating(0);
    setOnlineOnly(false);
    setMinPrice("");
    setMaxPrice("");
  };

  const hasActiveFilters = type || selectedCrypto !== "All" || selectedPayment !== "All" || 
    amount || minRating > 0 || onlineOnly || minPrice || maxPrice;

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

      {/* Advanced Filters */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-4">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Advanced Filters
            {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 border-t border-border mt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Price Range */}
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground mb-2 block">Price Range (KES per unit)</label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="flex-1"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Minimum Rating */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Min Rating: {minRating > 0 ? `${minRating}+ stars` : "Any"}
              </label>
              <Slider
                value={[minRating]}
                onValueChange={(value) => setMinRating(value[0])}
                min={0}
                max={5}
                step={1}
                className="mt-2"
              />
            </div>

            {/* Online Only */}
            <div className="flex items-center gap-3">
              <Switch
                id="online-only"
                checked={onlineOnly}
                onCheckedChange={setOnlineOnly}
              />
              <Label htmlFor="online-only" className="text-sm cursor-pointer">
                🟡 Online traders only
              </Label>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear All Filters
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default MarketplaceFilters;
