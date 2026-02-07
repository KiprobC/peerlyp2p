import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
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
  { value: "All", label: "All", icon: Wallet },
  { value: "BTC", label: "BTC", icon: Wallet },
  { value: "USDT", label: "USDT", icon: Wallet },
  { value: "ETH", label: "ETH", icon: Wallet },
];

const paymentMethods = [
  { value: "All", label: "All", icon: Wallet },
  { value: "MPESA", label: "M-Pesa", icon: Smartphone },
  { value: "Bank Transfer", label: "Bank", icon: Building2 },
  { value: "Airtel Money", label: "Airtel", icon: Smartphone },
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
    <div className="bg-card border border-border rounded-lg mb-3 overflow-hidden shadow-[var(--shadow-card)]">
      {/* Compact Control Bar */}
      <div className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Buy/Sell Segmented Control */}
          <div className="flex p-0.5 bg-secondary rounded-lg border border-border/50">
            <button
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                type === "sell" 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setType(type === "sell" ? null : "sell")}
            >
              Buy
            </button>
            <button
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                type === "buy" 
                  ? "bg-destructive text-destructive-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setType(type === "buy" ? null : "buy")}
            >
              Sell
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-border/50 hidden sm:block" />

          {/* Crypto Select - Compact */}
          <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
            <SelectTrigger className="w-[80px] h-7 text-xs bg-secondary/40 border-0 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cryptos.map((crypto) => (
                <SelectItem key={crypto.value} value={crypto.value} className="text-xs">
                  {crypto.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Payment Method - Compact */}
          <Select value={selectedPayment} onValueChange={setSelectedPayment}>
            <SelectTrigger className="w-[90px] h-7 text-xs bg-secondary/40 border-0 px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((method) => (
                <SelectItem key={method.value} value={method.value} className="text-xs">
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Amount Input - Compact */}
          <div className="relative">
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-[100px] h-7 text-xs bg-secondary/40 border-0 px-2 pr-8"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
              KES
            </span>
          </div>

          {/* Right-aligned controls */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Online Toggle - Compact */}
            <div className="flex items-center gap-1.5">
              <div 
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  onlineOnly ? "bg-green-500" : "bg-muted-foreground/30"
                )} 
              />
              <Label htmlFor="online-quick" className="text-[10px] cursor-pointer text-muted-foreground">
                Online
              </Label>
              <Switch
                id="online-quick"
                checked={onlineOnly}
                onCheckedChange={setOnlineOnly}
                className="scale-75"
              />
            </div>

            {/* Advanced Filters Toggle - Compact */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-primary/20 text-primary">
                      {activeFilterCount}
                    </Badge>
                  )}
                  {advancedOpen ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>

            {/* Clear - Only visible when filters active */}
            {activeFilterCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                onClick={clearFilters}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel - Compact */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleContent>
          <div className="px-3 py-2 border-t border-border/30 bg-secondary/10">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {/* Price Range */}
              <div className="col-span-2">
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                  Price Range
                </label>
                <div className="flex gap-1 items-center">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="flex-1 h-7 text-xs bg-card border-0"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="flex-1 h-7 text-xs bg-card border-0"
                  />
                </div>
              </div>

              {/* Trader Level */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                  Trader Level
                </label>
                <Select 
                  value={minTierLevel || "any"} 
                  onValueChange={(v) => setMinTierLevel(v === "any" ? null : v as TraderTier)}
                >
                  <SelectTrigger className="h-7 text-xs bg-card border-0">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any" className="text-xs">Any</SelectItem>
                    {Object.values(TRADER_TIERS).map((tier) => (
                      <SelectItem key={tier.tier} value={tier.tier} className="text-xs">
                        <span className="flex items-center gap-1">
                          <span className="text-[10px]">{tier.icon}</span>
                          <span>{tier.label}+</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Completion Rate */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                  Completion: {minCompletionRate > 0 ? `${minCompletionRate}%+` : "Any"}
                </label>
                <Slider
                  value={[minCompletionRate]}
                  onValueChange={(value) => setMinCompletionRate(value[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>

              {/* Sort By */}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                  Sort By
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-7 text-xs bg-card border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="margin_asc" className="text-xs">Price ↑</SelectItem>
                    <SelectItem value="margin_desc" className="text-xs">Price ↓</SelectItem>
                    <SelectItem value="rating_desc" className="text-xs">Rating ↓</SelectItem>
                    <SelectItem value="trades_desc" className="text-xs">Trades ↓</SelectItem>
                    <SelectItem value="completion_desc" className="text-xs">Completion ↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default MarketplaceFilters;
