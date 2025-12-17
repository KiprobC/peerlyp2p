import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MarketplaceFilters from "@/components/marketplace/MarketplaceFilters";
import OfferCard from "@/components/marketplace/OfferCard";
import CreateOfferDialog from "@/components/marketplace/CreateOfferDialog";
import InitiateTradeDialog from "@/components/marketplace/InitiateTradeDialog";
import { useOffers, OfferWithProfile } from "@/hooks/useOffers";
import { useAuth } from "@/contexts/AuthContext";
import { isUserOnline } from "@/hooks/useOnlineStatus";

const Marketplace = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    type: null as "buy" | "sell" | null,
    crypto: "All",
    paymentMethod: "All",
    amount: "",
    minRating: 0,
    onlineOnly: false,
    minPrice: "",
    maxPrice: "",
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<OfferWithProfile | null>(null);

  const { offers, loading } = useOffers({
    type: filters.type || undefined,
    crypto_type: filters.crypto,
  });

  // Filter offers based on all criteria
  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                P2P <span className="gradient-text">Marketplace</span>
              </h1>
              <p className="text-muted-foreground">
                Find the best offers from verified traders across Kenya
              </p>
            </div>
            {user && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Offer
              </Button>
            )}
          </div>

          {/* Filters */}
          <MarketplaceFilters onFilterChange={setFilters} initialFilters={filters} />

          {/* Results Info */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              Showing <span className="text-foreground font-medium">{filteredOffers.length}</span> offers
            </p>
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
              {filteredOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={{
                    id: offer.id,
                    type: offer.type,
                    crypto: offer.crypto_type,
                    cryptoAmount: offer.crypto_amount,
                    fiatCurrency: offer.fiat_currency,
                    price: offer.price_per_unit,
                    minAmount: offer.min_amount,
                    maxAmount: offer.max_amount,
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
                  }}
                  onAction={() => handleOfferAction(offer)}
                />
              ))}
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
              })}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />

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
