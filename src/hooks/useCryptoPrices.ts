import { useState, useEffect, useCallback } from "react";

interface CryptoPrices {
  BTC: number;
  ETH: number;
  USDT: number;
  [key: string]: number;
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
};

// Fallback prices if API fails
const FALLBACK_PRICES: CryptoPrices = {
  BTC: 105000,
  ETH: 3800,
  USDT: 1,
};

export const useCryptoPrices = (currency: string = "USD") => {
  const [prices, setPrices] = useState<CryptoPrices>(FALLBACK_PRICES);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      const ids = Object.values(COINGECKO_IDS).join(",");
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currency.toLowerCase()}`
      );
      
      if (!response.ok) throw new Error("Failed to fetch prices");
      
      const data = await response.json();
      
      const newPrices: CryptoPrices = {
        BTC: data.bitcoin?.[currency.toLowerCase()] || FALLBACK_PRICES.BTC,
        ETH: data.ethereum?.[currency.toLowerCase()] || FALLBACK_PRICES.ETH,
        USDT: data.tether?.[currency.toLowerCase()] || FALLBACK_PRICES.USDT,
      };
      
      setPrices(newPrices);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching crypto prices:", error);
      // Keep existing prices on error
    } finally {
      setLoading(false);
    }
  }, [currency]);

  useEffect(() => {
    fetchPrices();
    
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const getPrice = useCallback((crypto: string): number => {
    return prices[crypto.toUpperCase()] || 0;
  }, [prices]);

  const calculateOfferPrice = useCallback((
    crypto: string,
    marginPercent: number
  ): number => {
    const basePrice = getPrice(crypto);
    return basePrice * (1 + marginPercent / 100);
  }, [getPrice]);

  return {
    prices,
    loading,
    lastUpdated,
    getPrice,
    calculateOfferPrice,
    refetch: fetchPrices,
  };
};

// USD to KES conversion rate (you might want to fetch this dynamically too)
export const USD_TO_KES = 129;

export const convertToKES = (usdPrice: number): number => {
  return Math.round(usdPrice * USD_TO_KES);
};
