import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Globe, TrendingUp, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/layout/Navbar";
import MarketplaceFilters from "@/components/marketplace/MarketplaceFilters";
import OfferCard from "@/components/marketplace/OfferCard";
import CreateOfferDialog from "@/components/marketplace/CreateOfferDialog";
import InitiateTradeDialog from "@/components/marketplace/InitiateTradeDialog";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useOffers, OfferWithProfile } from "@/hooks/useOffers";
import { useAuth } from "@/contexts/AuthContext";
import { isUserOnline } from "@/hooks/useOnlineStatus";
import { useSettings } from "@/hooks/useSettings";
import { useProfile } from "@/hooks/useProfile";
import { useCurrencyConversion, useCountries } from "@/hooks/useCountries";
import { calculateTraderTier, TraderTier, TRADER_TIERS } from "@/lib/traderTiers";

const Marketplace = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { profile } = useProfile();
  const { convert } = useCurrencyConversion();
  const { countries, getCountryByCode } = useCountries();

  const userCountry = profile?.country || profile?.kyc_country || null;
  const preferredCurrency = settings?.preferred_currency || "USD";
  
  const countryData = userCountry ? getCountryByCode(userCountry) : null;
  const countryCurrency = countryData?.currency_code || null;

  const [showGlobalOffers, setShowGlobalOffers] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  const regionOptions = useMemo(() => {
    const uniqueCurrencies = new Map<string, { code: string; name: string; flag: string | null }>();
    countries.forEach((c) => {
      if (!uniqueCurrencies.has(c.currency_code)) {
        uniqueCurrencies.set(c.currency_code, {
          code: c.currency_code,
          name: c.name,
          flag: c.flag_emoji,
        });
      }
    });
    return Array.from(uniqueCurrencies.values());
  }, [countries]);

  const [filters, setFilters] = useState({
    type: null as "buy" | "sell" | null,
    crypto: "All",
    paymentMethod: "All",
    amount: "",
    minRating: 0,
    onlineOnly: false,
    minPrice: "",
    maxPrice: "",
    sortBy: "margin_asc",
    minTierLevel: null as TraderTier | null,
    minCompletionRate: 0,
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<OfferWithProfile | null>(null);

  const fiatCurrencyFilter = useMemo(() => {
    if (!showGlobalOffers) {
      return countryCurrency || undefined;
    }
    if (selectedRegion !== "all") {
      return selectedRegion;
    }
    return undefined;
  }, [showGlobalOffers, selectedRegion, countryCurrency]);

  const { offers, loading } = useOffers({
    type: filters.type || undefined,
    crypto_type: filters.crypto,
    fiat_currency: fiatCurrencyFilter,
  });

  const filteredOffers = useMemo(() => {
    let result = offers.filter((offer) => {
      if (offer.user_id === user?.id) return false;

      if (filters.paymentMethod !== "All") {
        if (!offer.payment_methods.includes(filters.paymentMethod)) return false;
      }

      if (filters.amount) {
        const amount = parseFloat(filters.amount);
        if (amount < offer.min_amount || amount > offer.max_amount) return false;
      }

      if (filters.minRating > 0) {
        if ((offer.trader_rating || 0) < filters.minRating) return false;
      }

      if (filters.onlineOnly) {
        if (!isUserOnline(offer.trader_last_seen || null)) return false;
      }

      if (filters.minPrice) {
        const minPrice = parseFloat(filters.minPrice);
        if (offer.price_per_unit < minPrice) return false;
      }
      if (filters.maxPrice) {
        const maxPrice = parseFloat(filters.maxPrice);
        if (offer.price_per_unit > maxPrice) return false;
      }

      // Filter by trader tier
      if (filters.minTierLevel) {
        const traderTier = calculateTraderTier(
          offer.trader_trades || 0, 
          offer.trader_successful_trades ?? offer.trader_trades ?? 0
        );
        const tierOrder: TraderTier[] = ["bronze", "silver", "gold", "pro"];
        const minTierIndex = tierOrder.indexOf(filters.minTierLevel);
        const traderTierIndex = tierOrder.indexOf(traderTier.tier);
        if (traderTierIndex < minTierIndex) return false;
      }

      // Filter by completion rate
      if (filters.minCompletionRate > 0) {
        const successfulTrades = offer.trader_successful_trades ?? offer.trader_trades ?? 0;
        const totalTrades = offer.trader_trades || 1;
        const completionRate = (successfulTrades / totalTrades) * 100;
        if (completionRate < filters.minCompletionRate) return false;
      }

      return true;
    });

    // Apply sorting
    switch (filters.sortBy) {
      case "margin_asc":
        result.sort((a, b) => (a.price_margin || 0) - (b.price_margin || 0));
        break;
      case "margin_desc":
        result.sort((a, b) => (b.price_margin || 0) - (a.price_margin || 0));
        break;
      case "rating_desc":
        result.sort((a, b) => (b.trader_rating || 0) - (a.trader_rating || 0));
        break;
      case "trades_desc":
        result.sort((a, b) => (b.trader_trades || 0) - (a.trader_trades || 0));
        break;
      case "completion_desc":
        result.sort((a, b) => {
          const aRate = (a.trader_successful_trades ?? a.trader_trades ?? 0) / (a.trader_trades || 1);
          const bRate = (b.trader_successful_trades ?? b.trader_trades ?? 0) / (b.trader_trades || 1);
          return bRate - aRate;
        });
        break;
    }

    return result;
  }, [offers, filters, user?.id]);

  const handleOfferAction = (offer: OfferWithProfile) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setSelectedOffer(offer);
    setTradeDialogOpen(true);
  };

  // Stats for the header
  const onlineTraders = useMemo(() => {
    return new Set(offers.filter(o => isUserOnline(o.trader_last_seen || null)).map(o => o.user_id)).size;
  }, [offers]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-24 md:pb-16">
        <div className="container mx-auto px-3 md:px-4">
          {/* Compact Header Bar */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            {/* Title + Stats inline */}
            <div className="flex items-center gap-3">
              <h1 className="text-base md:text-lg font-bold text-foreground">
                P2P Trading
              </h1>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-secondary/40 rounded text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span className="font-medium text-foreground">{filteredOffers.length}</span>
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-secondary/40 rounded text-muted-foreground">
                  <Users className="w-3 h-3 text-green-500" />
                  <span className="font-medium text-foreground">{onlineTraders}</span>
                </span>
              </div>
            </div>
            
            {/* Global Toggle - Compact */}
            <div className="flex items-center gap-2">
              {!showGlobalOffers && countryCurrency && (
                <span className="text-[10px] text-muted-foreground">
                  <span className="text-foreground font-medium">{countryCurrency}</span>
                </span>
              )}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-secondary/30 rounded-md">
                <Globe className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground hidden sm:inline">Global</span>
                <Switch 
                  checked={showGlobalOffers} 
                  onCheckedChange={(checked) => {
                    setShowGlobalOffers(checked);
                    if (!checked) setSelectedRegion("all");
                  }}
                  className="scale-75"
                />
              </div>
              
              {showGlobalOffers && (
                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                  <SelectTrigger className="w-[90px] h-6 text-[10px] bg-secondary/30 border-0 px-2">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Regions</SelectItem>
                    {regionOptions.map((region) => (
                      <SelectItem key={region.code} value={region.code} className="text-xs">
                        {region.flag && <span className="mr-1">{region.flag}</span>}
                        {region.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Filters - Now Compact Control Bar */}
          <MarketplaceFilters 
            onFilterChange={(f) => setFilters({ ...filters, ...f })} 
            initialFilters={filters} 
          />

          {/* Offers Grid */}
          <ErrorBoundary>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-lg" />
                ))}
              </div>
            ) : filteredOffers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                {filteredOffers.map((offer) => {
                  const offerCurrency = offer?.fiat_currency || "KES";
                  const isOutsideRegion = showGlobalOffers && countryCurrency && offerCurrency !== countryCurrency;
                  const convertedPrice = preferredCurrency !== offerCurrency 
                    ? convert(offer?.price_per_unit ?? 0, offerCurrency, preferredCurrency)
                    : offer?.price_per_unit ?? 0;
                  const convertedMin = preferredCurrency !== offerCurrency
                    ? convert(offer?.min_amount ?? 0, offerCurrency, preferredCurrency)
                    : offer?.min_amount ?? 0;
                  const convertedMax = preferredCurrency !== offerCurrency
                    ? convert(offer?.max_amount ?? 0, offerCurrency, preferredCurrency)
                    : offer?.max_amount ?? 0;

                  return (
                    <div key={offer?.id || Math.random()} className="relative">
                      {isOutsideRegion && (
                        <Badge 
                          variant="outline" 
                          className="absolute -top-2 -right-2 z-10 text-[10px] bg-background border-amber-500/50 text-amber-500"
                        >
                          <Globe className="w-2.5 h-2.5 mr-1" />
                          {offerCurrency}
                        </Badge>
                      )}
                      <OfferCard
                        offer={{
                          id: offer?.id || "",
                          type: offer?.type || "buy",
                          crypto: offer?.crypto_type || "BTC",
                          cryptoAmount: offer?.crypto_amount ?? 0,
                          availableAmount: offer?.available_amount ?? (offer?.crypto_amount ?? 0),
                          fiatCurrency: preferredCurrency,
                          price: convertedPrice,
                          minAmount: convertedMin,
                          maxAmount: convertedMax,
                          paymentMethods: offer?.payment_methods ?? [],
                          trader: {
                            name: offer?.trader_name || "Anonymous",
                            avatar: offer?.trader_avatar,
                            rating: offer?.trader_rating ?? 0,
                            trades: offer?.trader_trades ?? 0,
                            verified: offer?.trader_verified ?? false,
                            positiveCount: offer?.trader_positive_count ?? 0,
                            lastSeen: offer?.trader_last_seen,
                            successfulTrades: offer?.trader_successful_trades,
                          },
                          timeLimit: offer?.time_limit ?? 30,
                          priceMargin: offer?.price_margin,
                        }}
                        onAction={() => handleOfferAction(offer)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/50 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No offers found</h3>
                <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
                  Try adjusting your filters or check back later for new trading opportunities.
                </p>
                <Button variant="outline" onClick={() => setFilters({
                  type: null,
                  crypto: "All",
                  paymentMethod: "All",
                  amount: "",
                  minRating: 0,
                  onlineOnly: false,
                  minPrice: "",
                  maxPrice: "",
                  sortBy: "margin_asc",
                  minTierLevel: null,
                  minCompletionRate: 0,
                })}>
                  Clear All Filters
                </Button>
              </div>
            )}
          </ErrorBoundary>
        </div>
      </main>
      
      {/* Dialogs */}
      <CreateOfferDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <ErrorBoundary>
        <InitiateTradeDialog 
          open={tradeDialogOpen} 
          onOpenChange={setTradeDialogOpen} 
          offer={selectedOffer}
          isOutsideRegion={Boolean(showGlobalOffers && countryCurrency && selectedOffer?.fiat_currency !== countryCurrency)}
          userCurrency={countryCurrency}
        />
      </ErrorBoundary>
    </div>
  );
};

export default Marketplace;
