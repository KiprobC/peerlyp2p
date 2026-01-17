import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  SlidersHorizontal, 
  ChevronDown, 
  ChevronUp, 
  X,
  Wallet,
  Smartphone,
  Building2,
  Banknote
} from "lucide-react";
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
import { TRADER_TIERS, TraderTier } from "@/lib/traderTiers";
import { cn } from "@/lib/utils";

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
    minTierLevel: TraderTier | null;
    minCompletionRate: number;
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
    minTierLevel?: TraderTier | null;
    minCompletionRate?: number;
  };
}

const cryptos = [
  { value: "All", label: "All Crypto", icon: Wallet },
  { value: "BTC", label: "Bitcoin", icon: Wallet },
  { value: "USDT", label: "USDT", icon: Wallet },
  { value: "ETH", label: "Ethereum", icon: Wallet },
];

const paymentMethods = [
  { value: "All", label: "All Methods", icon: Wallet },
  { value: "MPESA", label: "M-Pesa", icon: Smartphone },
  { value: "Bank Transfer", label: "Bank Transfer", icon: Building2 },
  { value: "Airtel Money", label: "Airtel Money", icon: Smartphone },
  { value: "Cash", label: "Cash", icon: Banknote },
];

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
  const [minTierLevel, setMinTierLevel] = useState<TraderTier | null>(initialFilters?.minTierLevel || null);
  const [minCompletionRate, setMinCompletionRate] = useState(initialFilters?.minCompletionRate || 0);
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
      minTierLevel,
      minCompletionRate,
    });
  }, [type, selectedCrypto, selectedPayment, amount, minRating, onlineOnly, minPrice, maxPrice, sortBy, minTierLevel, minCompletionRate]);

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
    setMinTierLevel(null);
    setMinCompletionRate(0);
  };

  const activeFilterCount = [
    type,
    selectedCrypto !== "All",
    selectedPayment !== "All",
    amount,
    minRating > 0,
    onlineOnly,
    minPrice,
    maxPrice,
    minTierLevel,
    minCompletionRate > 0,
  ].filter(Boolean).length;

  return (
    <div className="bg-card border border-border rounded-xl mb-6 overflow-hidden">
      {/* Primary Filters Row */}
      <div className="p-4">
        {/* Trade Type Toggle - Binance Style */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg mb-4 w-fit">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-6 h-9 rounded-md font-semibold transition-all",
              type === "sell" 
                ? "bg-green-500 text-white hover:bg-green-600 shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
            )}
            onClick={() => setType(type === "sell" ? null : "sell")}
          >
            Buy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "px-6 h-9 rounded-md font-semibold transition-all",
              type === "buy" 
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm" 
                : "text-muted-foreground hover:text-foreground hover:bg-transparent"
            )}
            onClick={() => setType(type === "buy" ? null : "buy")}
          >
            Sell
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Crypto Select */}
          <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
            <SelectTrigger className="w-[130px] h-9 text-sm bg-secondary/30 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cryptos.map((crypto) => (
                <SelectItem key={crypto.value} value={crypto.value}>
                  <div className="flex items-center gap-2">
                    <crypto.icon className="w-4 h-4 text-muted-foreground" />
                    <span>{crypto.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Payment Method */}
          <Select value={selectedPayment} onValueChange={setSelectedPayment}>
            <SelectTrigger className="w-[150px] h-9 text-sm bg-secondary/30 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  <div className="flex items-center gap-2">
                    <method.icon className="w-4 h-4 text-muted-foreground" />
                    <span>{method.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Amount Input */}
          <div className="relative">
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-[140px] h-9 text-sm bg-secondary/30 border-border pr-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              KES
            </span>
          </div>

          {/* Search Button */}
          <Button size="sm" className="h-9 px-4 gap-1.5 font-semibold">
            <Search className="w-4 h-4" />
            Search
          </Button>

          {/* Advanced Filters Toggle */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-1.5 text-sm bg-secondary/30 border-border"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
                {advancedOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          {/* Online Only - Quick Toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <div 
              className={cn(
                "w-2 h-2 rounded-full",
                onlineOnly ? "bg-green-500" : "bg-muted-foreground/30"
              )} 
            />
            <Label htmlFor="online-quick" className="text-xs cursor-pointer text-muted-foreground">
              Online
            </Label>
            <Switch
              id="online-quick"
              checked={onlineOnly}
              onCheckedChange={setOnlineOnly}
              className="scale-90"
            />
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleContent>
          <div className="p-4 pt-0 border-t border-border bg-secondary/20">
            <div className="pt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Price Range */}
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Price Range (KES)
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="flex-1 h-9 text-sm bg-card"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="flex-1 h-9 text-sm bg-card"
                  />
                </div>
              </div>

              {/* Trader Badge Level */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Trader Level
                </label>
                <Select 
                  value={minTierLevel || "any"} 
                  onValueChange={(v) => setMinTierLevel(v === "any" ? null : v as TraderTier)}
                >
                  <SelectTrigger className="h-9 text-sm bg-card">
                    <SelectValue placeholder="Any level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Level</SelectItem>
                    {Object.values(TRADER_TIERS).map((tier) => (
                      <SelectItem key={tier.tier} value={tier.tier}>
                        <span className="flex items-center gap-2">
                          <span>{tier.icon}</span>
                          <span>{tier.label}+</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Completion Rate */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Completion: {minCompletionRate > 0 ? `${minCompletionRate}%+` : "Any"}
                </label>
                <Slider
                  value={[minCompletionRate]}
                  onValueChange={(value) => setMinCompletionRate(value[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="mt-3"
                />
              </div>

              {/* Sort By */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Sort By
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9 text-sm bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margin_asc">Price: Low to High</SelectItem>
                    <SelectItem value="margin_desc">Price: High to Low</SelectItem>
                    <SelectItem value="rating_desc">Rating: High to Low</SelectItem>
                    <SelectItem value="trades_desc">Trades: Most First</SelectItem>
                    <SelectItem value="completion_desc">Completion: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <div className="mt-4 flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  <X className="w-3 h-3" />
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default MarketplaceFilters;
