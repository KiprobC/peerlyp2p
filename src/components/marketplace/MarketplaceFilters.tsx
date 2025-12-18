import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Search, Filter, ChevronDown, ChevronUp, Wallet, CreditCard } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    sortBy: string;
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
    sortBy?: string;
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
  const [sortBy, setSortBy] = useState(initialFilters?.sortBy || "margin_asc");
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
      sortBy,
    });
  }, [type, selectedCrypto, selectedPayment, amount, minRating, onlineOnly, minPrice, maxPrice, sortBy]);

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
      sortBy,
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
    setSortBy("margin_asc");
  };

  const hasActiveFilters = type || selectedCrypto !== "All" || selectedPayment !== "All" || 
    amount || minRating > 0 || onlineOnly || minPrice || maxPrice;

  return (
    <div className="glass-card mb-6 p-4">
      {/* Trade Type Toggle - Compact */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={type === "sell" ? "default" : "secondary"}
          size="sm"
          className="flex-1"
          onClick={() => setType(type === "sell" ? null : "sell")}
        >
          Buy Crypto
        </Button>
        <Button
          variant={type === "buy" ? "default" : "secondary"}
          size="sm"
          className="flex-1"
          onClick={() => setType(type === "buy" ? null : "buy")}
        >
          Sell Crypto
        </Button>
      </div>

      {/* Compact Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Crypto Dropdown */}
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cryptos.map((crypto) => (
                <SelectItem key={crypto} value={crypto} className="text-xs">
                  {crypto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Method Dropdown */}
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedPayment} onValueChange={setSelectedPayment}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((method) => (
                <SelectItem key={method} value={method} className="text-xs">
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <Input
          type="number"
          placeholder="Amount (KES)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32 h-8 text-xs"
        />

        {/* Search Button */}
        <Button size="sm" className="h-8" onClick={handleSearch}>
          <Search className="w-3 h-3 mr-1" />
          Search
        </Button>

        {/* Advanced Filters Toggle */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              Filters
              {advancedOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Advanced Filters Content */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleContent className="pt-4 border-t border-border mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Price Range */}
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Price Range (KES)</label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
                <span className="text-muted-foreground text-xs">-</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="flex-1 h-8 text-xs"
                />
              </div>
            </div>

            {/* Minimum Rating */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Rating: {minRating > 0 ? `${minRating}+` : "Any"}
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

            {/* Sort By */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="margin_asc" className="text-xs">Margin: Low → High</SelectItem>
                  <SelectItem value="margin_desc" className="text-xs">Margin: High → Low</SelectItem>
                  <SelectItem value="rating_desc" className="text-xs">Rating: High → Low</SelectItem>
                  <SelectItem value="trades_desc" className="text-xs">Trades: High → Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Online Only */}
            <div className="flex items-center gap-2">
              <Switch
                id="online-only"
                checked={onlineOnly}
                onCheckedChange={setOnlineOnly}
              />
              <Label htmlFor="online-only" className="text-xs cursor-pointer">
                Online only
              </Label>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={clearFilters}>
                Clear All
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default MarketplaceFilters;
