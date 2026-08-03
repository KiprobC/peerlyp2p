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
  Banknote,
  Globe
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
  globalToggle?: {
    showGlobal: boolean;
    onToggle: (v: boolean) => void;
    countryCurrency: string | null;
    selectedRegion: string;
    onRegionChange: (v: string) => void;
    regionOptions: { code: string; name: string; flag: string | null }[];
  };
}

const cryptos = [
  { value: "All", label: "All" },
  { value: "BTC", label: "BTC" },
  { value: "USDT", label: "USDT" },
  { value: "ETH", label: "ETH" },
];

const paymentMethods = [
  { value: "All", label: "All Methods" },
  { value: "MPESA", label: "M-Pesa" },
  { value: "Bank Transfer", label: "Bank" },
  { value: "Airtel Money", label: "Airtel" },
  { value: "Cash", label: "Cash" },
];

const MarketplaceFilters = ({ onFilterChange, initialFilters, globalToggle }: MarketplaceFiltersProps) => {
  const [type, setType] = useState<"buy" | "sell" | null>(initialFilters?.type || null);
  const [selectedCrypto, setSelectedCrypto] = useState(initialFilters?.crypto || "All");
  const [selectedPayment, setSelectedPayment] = useState(initialFilters?.paymentMethod || "All");
  const [amount, setAmount] = useState(initialFilters?.amount || "");
  const [minRating, setMinRating] = useState(initialFilters?.minRating || 0);
  const [onlineOnly, setOnlineOnly] = useState(initialFilters?.onlineOnly || false);
  const [minPrice, setMinPrice] = useState(initialFilters?.minPrice || "");
  const [maxPrice, setMaxPrice] = useState(initialFilters?.maxPrice || "");
  const [sortBy, setSortBy] = useState(initialFilters?.sortBy || "smart");
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
  // Sync externally-driven type changes (e.g. Home page Buy/Sell entry points)
  useEffect(() => {
    const external = initialFilters?.type ?? null;
    setType((prev) => (prev === external ? prev : external));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilters?.type]);


  const clearFilters = () => {
    setType(null);
    setSelectedCrypto("All");
    setSelectedPayment("All");
    setAmount("");
    setMinRating(0);
    setOnlineOnly(false);
    setMinPrice("");
    setMaxPrice("");
    setSortBy("smart");
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
    <div className="mb-4 w-full min-w-0">
      {/* Segmented Buy/Sell Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 min-w-0">
        <div className="flex p-1 bg-secondary/60 rounded-2xl shrink-0">
          <button
            className={cn(
              "px-4 sm:px-6 py-2 text-sm font-semibold rounded-xl transition-all duration-200",
              type === "sell"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setType(type === "sell" ? null : "sell")}
          >
            Buy
          </button>
          <button
            className={cn(
              "px-4 sm:px-6 py-2 text-sm font-semibold rounded-xl transition-all duration-200",
              type === "buy"
                ? "bg-destructive text-destructive-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setType(type === "buy" ? null : "buy")}
          >
            Sell
          </button>
        </div>

        {/* Online toggle + clear */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-secondary/40 shrink-0">
            <div className={cn(
              "w-2 h-2 rounded-full transition-colors",
              onlineOnly ? "bg-success" : "bg-muted-foreground/30"
            )} />
            <Label htmlFor="online-pill" className="text-xs cursor-pointer text-muted-foreground">
              Online
            </Label>
            <Switch
              id="online-pill"
              checked={onlineOnly}
              onCheckedChange={setOnlineOnly}
              className="scale-75"
            />
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive rounded-xl shrink-0"
              onClick={clearFilters}
            >
              <X className="w-3.5 h-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Clear</span>
              <span className="sr-only">Clear filters</span>
            </Button>
          )}
        </div>

      </div>

      {/* Floating filter container */}
      <div className="bg-card/80 backdrop-blur-md border border-border/30 rounded-3xl p-3 shadow-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Crypto pills */}
          <div className="flex gap-1 p-0.5 bg-secondary/40 rounded-2xl shrink-0">
            {cryptos.map((c) => (
              <button
                key={c.value}
                onClick={() => setSelectedCrypto(c.value)}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-xl transition-all duration-150",
                  selectedCrypto === c.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Payment method */}
          <Select value={selectedPayment} onValueChange={setSelectedPayment}>
            <SelectTrigger className="w-[104px] sm:w-[120px] h-8 text-xs bg-secondary/40 border-0 rounded-xl px-3 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {paymentMethods.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs rounded-lg">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Amount */}
          <div className="relative flex-1 min-w-[100px] sm:flex-none">
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full sm:w-[110px] h-8 text-xs bg-secondary/40 border-0 rounded-xl px-3 pr-9"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
              KES
            </span>
          </div>

          {/* Spacer */}
          <div className="hidden sm:block flex-1" />


          {/* Advanced toggle */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary border-0 rounded-full">
                    {activeFilterCount}
                  </Badge>
                )}
                {advancedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Advanced panel */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleContent>
            <div className="mt-3 pt-3 border-t border-border/20">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* Price Range */}
                <div className="col-span-2">
                  <label className="text-[10px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                    Price Range
                  </label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="flex-1 h-8 text-xs bg-secondary/40 border-0 rounded-xl"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="flex-1 h-8 text-xs bg-secondary/40 border-0 rounded-xl"
                    />
                  </div>
                </div>

                {/* Trader Level */}
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                    Trader Level
                  </label>
                  <Select
                    value={minTierLevel || "any"}
                    onValueChange={(v) => setMinTierLevel(v === "any" ? null : v as TraderTier)}
                  >
                    <SelectTrigger className="h-8 text-xs bg-secondary/40 border-0 rounded-xl">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="any" className="text-xs rounded-lg">Any</SelectItem>
                      {Object.values(TRADER_TIERS).map((tier) => (
                        <SelectItem key={tier.tier} value={tier.tier} className="text-xs rounded-lg">
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
                  <label className="text-[10px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                    Completion {minCompletionRate > 0 ? `${minCompletionRate}%+` : ""}
                  </label>
                  <Slider
                    value={[minCompletionRate]}
                    onValueChange={(value) => setMinCompletionRate(value[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="mt-2.5"
                  />
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                    Sort By
                  </label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="h-8 text-xs bg-secondary/40 border-0 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="smart" className="text-xs rounded-lg">⚡ Smart Sort</SelectItem>
                      <SelectItem value="price_asc" className="text-xs rounded-lg">Best Price ↑</SelectItem>
                      <SelectItem value="price_desc" className="text-xs rounded-lg">Best Price ↓</SelectItem>
                      <SelectItem value="completion_desc" className="text-xs rounded-lg">Completion Rate</SelectItem>
                      <SelectItem value="online_first" className="text-xs rounded-lg">Online Traders</SelectItem>
                      <SelectItem value="rating_desc" className="text-xs rounded-lg">Highest Rating</SelectItem>
                      <SelectItem value="trades_desc" className="text-xs rounded-lg">Most Trades</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Global toggle inside advanced */}
                {globalToggle && (
                  <div className="col-span-2 md:col-span-5 flex items-center gap-3 pt-2 border-t border-border/20">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/40">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Global Market</span>
                      {!globalToggle.showGlobal && globalToggle.countryCurrency && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-primary/30 text-primary rounded-lg">
                          {globalToggle.countryCurrency}
                        </Badge>
                      )}
                      <Switch
                        checked={globalToggle.showGlobal}
                        onCheckedChange={(checked) => {
                          globalToggle.onToggle(checked);
                          if (!checked) globalToggle.onRegionChange("all");
                        }}
                        className="scale-75"
                      />
                    </div>
                    {globalToggle.showGlobal && (
                      <Select value={globalToggle.selectedRegion} onValueChange={globalToggle.onRegionChange}>
                        <SelectTrigger className="w-[120px] h-8 text-xs bg-secondary/40 border-0 rounded-xl">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all" className="text-xs rounded-lg">All Regions</SelectItem>
                          {globalToggle.regionOptions.map((region) => (
                            <SelectItem key={region.code} value={region.code} className="text-xs rounded-lg">
                              {region.flag && <span className="mr-1">{region.flag}</span>}
                              {region.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export default MarketplaceFilters;
