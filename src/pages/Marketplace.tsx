import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import MarketplaceFilters from "@/components/marketplace/MarketplaceFilters";
import OfferCard from "@/components/marketplace/OfferCard";
import CreateOfferDialog from "@/components/marketplace/CreateOfferDialog";
import InitiateTradeDialog from "@/components/marketplace/InitiateTradeDialog";
import { useOffers, OfferWithProfile } from "@/hooks/useOffers";
import { useAuth } from "@/contexts/AuthContext";
import { isUserOnline } from "@/hooks/useOnlineStatus";
import { useSettings } from "@/hooks/useSettings";
import { useProfile } from "@/hooks/useProfile";
import { useCurrencyConversion, useCountries } from "@/hooks/useCountries";

const Marketplace = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { profile } = useProfile();
  const { convert } = useCurrencyConversion();
  const { getCountryByCode } = useCountries();

  // Get user's country and preferred currency
  const userCountry = profile?.country || profile?.kyc_country || null;
  const preferredCurrency = settings?.preferred_currency || "USD";
  
  // Get country's currency code
  const countryData = userCountry ? getCountryByCode(userCountry) : null;
  const countryCurrency = countryData?.currency_code || null;

  // Toggle to show all offers globally
  const [showGlobalOffers, setShowGlobalOffers] = useState(false);

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
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<OfferWithProfile | null>(null);

  const { offers, loading } = useOffers({
    type: filters.type || undefined,
    crypto_type: filters.crypto,
    fiat_currency: showGlobalOffers ? undefined : (countryCurrency || undefined),
  });

  // Filter and sort offers based on all criteria
  const filteredOffers = useMemo(() => {
    let result = offers.filter((offer) => {
      // Don't show user's own offers
      if (offer.user_id === user?.id) return false;

      // Payment method filter
      if (filters.paymentMethod !== "All") {
        if (!offer.payment_methods.includes(filters.paymentMethod)) return false;
      }

      // Amount filter
      if (filters.amount) {
        const amount = parseFloat(filters.amount);
        if (amount < offer.min_amount || amount > offer.max_amount) return false;
      }

      // Minimum rating filter
      if (filters.minRating > 0) {
        if ((offer.trader_rating || 0) < filters.minRating) return false;
      }

      // Online only filter
      if (filters.onlineOnly) {
        if (!isUserOnline(offer.trader_last_seen || null)) return false;
      }

      // Price range filter
      if (filters.minPrice) {
        const minPrice = parseFloat(filters.minPrice);
        if (offer.price_per_unit < minPrice) return false;
      }
      if (filters.maxPrice) {
        const maxPrice = parseFloat(filters.maxPrice);
        if (offer.price_per_unit > maxPrice) return false;
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
    }

    return result;
  }, [offers, filters, user?.id]);

  const handleOfferAction = (offer: OfferWithProfile) => {
    if (!user) {
      // Redirect to login
      window.location.href = "/login";
      return;
    }
    setSelectedOffer(offer);
    setTradeDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-24 md:pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="gradient-text">Marketplace</span>
            </h1>
          </div>

          {/* Filters */}
          <MarketplaceFilters onFilterChange={setFilters} initialFilters={filters} />

          {/* Results Info & Global Toggle */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Showing <span className="text-foreground font-medium">{filteredOffers.length}</span> offers
                {!showGlobalOffers && countryCurrency && (
                  <span className="ml-1">in {countryCurrency}</span>
                )}
                {showGlobalOffers && (
                  <span className="ml-1 text-primary">globally</span>
                )}
              </p>
              {preferredCurrency && (
                <span className="text-xs text-muted-foreground/70">
                  (prices in {preferredCurrency})
                </span>
              )}
            </div>
            
            {/* Global Offers Toggle */}
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Global</span>
              <Switch 
                checked={showGlobalOffers} 
                onCheckedChange={setShowGlobalOffers}
              />
            </div>
          </div>

          {/* Offers Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : filteredOffers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOffers.map((offer) => {
                // Convert price to user's preferred currency
                const offerCurrency = offer.fiat_currency || "KES";
                const isOutsideRegion = showGlobalOffers && countryCurrency && offerCurrency !== countryCurrency;
                const convertedPrice = preferredCurrency !== offerCurrency 
                  ? convert(offer.price_per_unit, offerCurrency, preferredCurrency)
                  : offer.price_per_unit;
                const convertedMin = preferredCurrency !== offerCurrency
                  ? convert(offer.min_amount, offerCurrency, preferredCurrency)
                  : offer.min_amount;
                const convertedMax = preferredCurrency !== offerCurrency
                  ? convert(offer.max_amount, offerCurrency, preferredCurrency)
                  : offer.max_amount;

                return (
                  <div key={offer.id} className="relative">
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
                        id: offer.id,
                        type: offer.type,
                        crypto: offer.crypto_type,
                        cryptoAmount: offer.crypto_amount,
                        fiatCurrency: preferredCurrency,
                        price: convertedPrice,
                        minAmount: convertedMin,
                        maxAmount: convertedMax,
                        paymentMethods: offer.payment_methods,
                        trader: {
                          name: offer.trader_name || "Anonymous",
                          avatar: offer.trader_avatar,
                          rating: offer.trader_rating || 0,
                          trades: offer.trader_trades || 0,
                          verified: offer.trader_verified || false,
                          positiveCount: offer.trader_positive_count || 0,
                          lastSeen: offer.trader_last_seen,
                        },
                        timeLimit: offer.time_limit,
                        priceMargin: offer.price_margin,
                      }}
                      onAction={() => handleOfferAction(offer)}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No offers found matching your criteria</p>
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
              })}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </main>
      {/* Dialogs */}
      <CreateOfferDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <InitiateTradeDialog 
        open={tradeDialogOpen} 
        onOpenChange={setTradeDialogOpen} 
        offer={selectedOffer}
      />
    </div>
  );
};

export default Marketplace;
