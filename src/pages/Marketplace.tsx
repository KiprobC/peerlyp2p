import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MarketplaceFilters from "@/components/marketplace/MarketplaceFilters";
import OfferCard from "@/components/marketplace/OfferCard";

// Mock data for demonstration
const mockOffers = [
  {
    id: "1",
    type: "sell" as const,
    crypto: "BTC",
    cryptoAmount: 0.5,
    fiatCurrency: "KES",
    price: 8250000,
    minAmount: 10000,
    maxAmount: 500000,
    paymentMethods: ["MPESA", "Bank Transfer"],
    trader: {
      name: "CryptoKing254",
      rating: 4.9,
      trades: 1250,
      verified: true,
    },
    timeLimit: 15,
  },
  {
    id: "2",
    type: "buy" as const,
    crypto: "USDT",
    cryptoAmount: 5000,
    fiatCurrency: "KES",
    price: 152,
    minAmount: 5000,
    maxAmount: 200000,
    paymentMethods: ["MPESA"],
    trader: {
      name: "NairobiTrader",
      rating: 4.7,
      trades: 856,
      verified: true,
    },
    timeLimit: 30,
  },
  {
    id: "3",
    type: "sell" as const,
    crypto: "ETH",
    cryptoAmount: 2,
    fiatCurrency: "KES",
    price: 425000,
    minAmount: 20000,
    maxAmount: 850000,
    paymentMethods: ["Bank Transfer", "Airtel Money"],
    trader: {
      name: "EthMaster",
      rating: 4.8,
      trades: 543,
      verified: true,
    },
    timeLimit: 20,
  },
  {
    id: "4",
    type: "sell" as const,
    crypto: "BTC",
    cryptoAmount: 0.25,
    fiatCurrency: "KES",
    price: 8180000,
    minAmount: 5000,
    maxAmount: 300000,
    paymentMethods: ["MPESA"],
    trader: {
      name: "BitMaster_KE",
      rating: 4.6,
      trades: 324,
      verified: false,
    },
    timeLimit: 15,
  },
  {
    id: "5",
    type: "buy" as const,
    crypto: "BTC",
    cryptoAmount: 1,
    fiatCurrency: "KES",
    price: 8320000,
    minAmount: 50000,
    maxAmount: 1000000,
    paymentMethods: ["MPESA", "Bank Transfer"],
    trader: {
      name: "SafariCrypto",
      rating: 5.0,
      trades: 2100,
      verified: true,
    },
    timeLimit: 30,
  },
  {
    id: "6",
    type: "sell" as const,
    crypto: "USDT",
    cryptoAmount: 10000,
    fiatCurrency: "KES",
    price: 150,
    minAmount: 1000,
    maxAmount: 500000,
    paymentMethods: ["MPESA", "Airtel Money"],
    trader: {
      name: "USDTKing",
      rating: 4.9,
      trades: 1875,
      verified: true,
    },
    timeLimit: 15,
  },
];

const Marketplace = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              P2P <span className="gradient-text">Marketplace</span>
            </h1>
            <p className="text-muted-foreground">
              Find the best offers from verified traders across Kenya
            </p>
          </div>

          {/* Filters */}
          <MarketplaceFilters />

          {/* Results Info */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              Showing <span className="text-foreground font-medium">{mockOffers.length}</span> offers
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sort by:</span>
              <select className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option>Price (Low to High)</option>
                <option>Price (High to Low)</option>
                <option>Rating</option>
                <option>Trade Count</option>
              </select>
            </div>
          </div>

          {/* Offers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockOffers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Marketplace;
