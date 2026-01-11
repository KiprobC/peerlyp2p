import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useEffect } from "react";

interface CryptoPrices {
  BTC: number;
  ETH: number;
  USDT: number;
  [key: string]: number;
}

interface PriceChanges {
  BTC: number;
  ETH: number;
  USDT: number;
  [key: string]: number;
}

interface PriceData {
  prices: CryptoPrices;
  changes: PriceChanges;
  lastUpdated: Date;
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
};

// Fallback prices if API fails - these are reasonable defaults
const FALLBACK_PRICES: CryptoPrices = {
  BTC: 105000,
  ETH: 3800,
  USDT: 1,
};

const FALLBACK_CHANGES: PriceChanges = {
  BTC: 0,
  ETH: 0,
  USDT: 0,
};

// Cache for persisting prices across component remounts
let cachedPriceData: PriceData | null = null;

const fetchCryptoPrices = async (currency: string): Promise<PriceData> => {
  const ids = Object.values(COINGECKO_IDS).join(",");
  
  // Try primary CoinGecko API
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currency.toLowerCase()}&include_24hr_change=true`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    const priceData: PriceData = {
      prices: {
        BTC: data.bitcoin?.[currency.toLowerCase()] || FALLBACK_PRICES.BTC,
        ETH: data.ethereum?.[currency.toLowerCase()] || FALLBACK_PRICES.ETH,
        USDT: data.tether?.[currency.toLowerCase()] || FALLBACK_PRICES.USDT,
      },
      changes: {
        BTC: data.bitcoin?.[`${currency.toLowerCase()}_24h_change`] || 0,
        ETH: data.ethereum?.[`${currency.toLowerCase()}_24h_change`] || 0,
        USDT: data.tether?.[`${currency.toLowerCase()}_24h_change`] || 0,
      },
      lastUpdated: new Date(),
    };
    
    // Update cache
    cachedPriceData = priceData;
    
    return priceData;
  } catch (error) {
    console.warn("CoinGecko API failed, using cached/fallback prices:", error);
    
    // Return cached data if available
    if (cachedPriceData) {
      return cachedPriceData;
    }
    
    // Return fallback
    return {
      prices: FALLBACK_PRICES,
      changes: FALLBACK_CHANGES,
      lastUpdated: new Date(),
    };
  }
};

export const useCryptoPrices = (currency: string = "USD") => {
  const queryClient = useQueryClient();
  const previousPricesRef = useRef<CryptoPrices>(cachedPriceData?.prices || FALLBACK_PRICES);
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["crypto-prices", currency],
    queryFn: () => fetchCryptoPrices(currency),
    staleTime: 10000, // Consider data stale after 10 seconds
    gcTime: 60000, // Keep in cache for 1 minute
    refetchInterval: 15000, // Refetch every 15 seconds for live updates
    refetchIntervalInBackground: false, // Don't refetch when tab is hidden
    retry: 2,
    retryDelay: 1000,
    placeholderData: cachedPriceData || {
      prices: FALLBACK_PRICES,
      changes: FALLBACK_CHANGES,
      lastUpdated: new Date(),
    },
  });

  // Store previous prices to prevent jumps
  useEffect(() => {
    if (data?.prices) {
      previousPricesRef.current = data.prices;
    }
  }, [data?.prices]);

  const prices = data?.prices || previousPricesRef.current || FALLBACK_PRICES;
  const changes = data?.changes || FALLBACK_CHANGES;
  const lastUpdated = data?.lastUpdated || null;

  const getPrice = useCallback((crypto: string): number => {
    return prices[crypto.toUpperCase()] || 0;
  }, [prices]);

  const getChange = useCallback((crypto: string): number => {
    return changes[crypto.toUpperCase()] || 0;
  }, [changes]);

  const calculateOfferPrice = useCallback((
    crypto: string,
    marginPercent: number
  ): number => {
    const basePrice = getPrice(crypto);
    return basePrice * (1 + marginPercent / 100);
  }, [getPrice]);

  return {
    prices,
    changes,
    loading: isLoading,
    lastUpdated,
    getPrice,
    getChange,
    calculateOfferPrice,
    refetch,
  };
};

// USD to KES conversion rate (you might want to fetch this dynamically too)
export const USD_TO_KES = 129;

export const convertToKES = (usdPrice: number): number => {
  return Math.round(usdPrice * USD_TO_KES);
};
