import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Globe, TrendingUp, Users } from "lucide-react";
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
    sortBy: "smart",
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
      if (filters.minCompletionRate > 0) {
        const successfulTrades = offer.trader_successful_trades ?? offer.trader_trades ?? 0;
        const totalTrades = offer.trader_trades || 1;
        const completionRate = (successfulTrades / totalTrades) * 100;
        if (completionRate < filters.minCompletionRate) return false;
      }
      return true;
    });

    // Helper functions for scoring
    const getCompletionRate = (o: OfferWithProfile) => {
      const successful = o.trader_successful_trades ?? o.trader_trades ?? 0;
      const total = o.trader_trades || 1;
      return successful / total;
    };

    const isOnline = (o: OfferWithProfile) => isUserOnline(o.trader_last_seen || null);

    switch (filters.sortBy) {
      case "smart":
      default: {
        // Smart sorting: Price → Completion Rate → Online → Release Speed → Verified
        result.sort((a, b) => {
          // 1. Price: lower for buy mode (sell offers), higher for sell mode (buy offers)
          const priceDir = filters.type === "buy" ? 1 : -1;
          const priceDiff = ((a.price_per_unit || 0) - (b.price_per_unit || 0)) * priceDir;
          if (Math.abs(priceDiff) > 0.01) {
            // Normalize price diff to a score weight
            const priceScore = priceDiff / Math.max(a.price_per_unit || 1, b.price_per_unit || 1);
            if (Math.abs(priceScore) > 0.001) return priceScore > 0 ? 1 : -1;
          }

          // 2. Completion rate (higher is better)
          const completionDiff = getCompletionRate(b) - getCompletionRate(a);
          if (Math.abs(completionDiff) > 0.02) return completionDiff > 0 ? 1 : -1;

          // 3. Online status
          const aOnline = isOnline(a) ? 1 : 0;
          const bOnline = isOnline(b) ? 1 : 0;
          if (bOnline !== aOnline) return bOnline - aOnline;

          // 4. Verified badge
          const aVerified = a.trader_verified ? 1 : 0;
          const bVerified = b.trader_verified ? 1 : 0;
          if (bVerified !== aVerified) return bVerified - aVerified;

          // 5. More trades = more trusted
          return (b.trader_trades || 0) - (a.trader_trades || 0);
        });

        // Amount compatibility boost: if user entered amount, boost offers that include it
        if (filters.amount) {
          const amt = parseFloat(filters.amount);
          if (!isNaN(amt)) {
            result.sort((a, b) => {
              const aFits = amt >= a.min_amount && amt <= a.max_amount;
              const bFits = amt >= b.min_amount && amt <= b.max_amount;
              if (aFits && !bFits) return -1;
              if (!aFits && bFits) return 1;
              return 0; // preserve existing order
            });
          }
        }
        break;
      }
      case "price_asc":
        result.sort((a, b) => (a.price_per_unit || 0) - (b.price_per_unit || 0));
        break;
      case "price_desc":
        result.sort((a, b) => (b.price_per_unit || 0) - (a.price_per_unit || 0));
        break;
      case "completion_desc":
        result.sort((a, b) => getCompletionRate(b) - getCompletionRate(a));
        break;
      case "online_first":
        result.sort((a, b) => {
          const aOn = isOnline(a) ? 1 : 0;
          const bOn = isOnline(b) ? 1 : 0;
          return bOn - aOn;
        });
        break;
      case "rating_desc":
        result.sort((a, b) => (b.trader_rating || 0) - (a.trader_rating || 0));
        break;
      case "trades_desc":
        result.sort((a, b) => (b.trader_trades || 0) - (a.trader_trades || 0));
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

  const onlineTraders = useMemo(() => {
    return new Set(offers.filter(o => isUserOnline(o.trader_last_seen || null)).map(o => o.user_id)).size;
  }, [offers]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-16 pb-24 md:pb-16">
        <div className="container mx-auto px-3 md:px-4 max-w-5xl">
          {/* Minimal header */}
          <div className="flex items-center justify-between mb-4 pt-2">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-foreground">P2P Market</h1>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 px-2 py-1 bg-secondary/50 rounded-xl text-[11px] text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span className="font-semibold text-foreground">{filteredOffers.length}</span>
                  <span className="hidden sm:inline">offers</span>
                </span>
                <span className="flex items-center gap-1 px-2 py-1 bg-secondary/50 rounded-xl text-[11px] text-muted-foreground">
                  <Users className="w-3 h-3 text-success" />
                  <span className="font-semibold text-foreground">{onlineTraders}</span>
                  <span className="hidden sm:inline">online</span>
                </span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <MarketplaceFilters
            onFilterChange={(f) => setFilters({ ...filters, ...f })}
            initialFilters={filters}
            globalToggle={{
              showGlobal: showGlobalOffers,
              onToggle: setShowGlobalOffers,
              countryCurrency,
              selectedRegion,
              onRegionChange: setSelectedRegion,
              regionOptions,
            }}
          />

          {/* Offers Grid */}
          <ErrorBoundary>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-2xl" />
                ))}
              </div>
            ) : filteredOffers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                          className="absolute -top-2 -right-2 z-10 text-[10px] bg-background border-warning/50 text-warning rounded-lg"
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
              <div className="text-center py-16 bg-card/60 backdrop-blur-sm border border-border/30 rounded-3xl">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary/50 flex items-center justify-center">
                  <TrendingUp className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">No offers found</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                  Try adjusting your filters or check back later.
                </p>
                <Button variant="outline" className="rounded-xl" onClick={() => setFilters({
                  type: null,
                  crypto: "All",
                  paymentMethod: "All",
                  amount: "",
                  minRating: 0,
                  onlineOnly: false,
                  minPrice: "",
                  maxPrice: "",
                  sortBy: "smart",
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
