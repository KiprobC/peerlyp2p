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

const fetchCoinGeckoPrices = async (currency: string): Promise<PriceData> => {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currency.toLowerCase()}&include_24hr_change=true`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
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
  return priceData;
};

/** Binance 24h tickers in USD (BTC + ETH; USDT tracks ~$1). */
const fetchBinancePrices = async (): Promise<PriceData> => {
  const symbols = encodeURIComponent(JSON.stringify(["BTCUSDT", "ETHUSDT"]));
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbols}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows: Array<{ symbol: string; lastPrice: string; priceChangePercent: string }> = await response.json();
  const bySymbol = Object.fromEntries(rows.map((row) => [row.symbol, row]));
  const priceData: PriceData = {
    prices: {
      BTC: Number(bySymbol.BTCUSDT?.lastPrice) || FALLBACK_PRICES.BTC,
      ETH: Number(bySymbol.ETHUSDT?.lastPrice) || FALLBACK_PRICES.ETH,
      USDT: 1,
    },
    changes: {
      BTC: Number(bySymbol.BTCUSDT?.priceChangePercent) || 0,
      ETH: Number(bySymbol.ETHUSDT?.priceChangePercent) || 0,
      USDT: 0,
    },
    lastUpdated: new Date(),
  };
  return priceData;
};

/** Coinbase 24h stats in USD (BTC + ETH; USDT tracks ~$1). */
const fetchCoinbasePrices = async (): Promise<PriceData> => {
  const fetchStats = async (product: string) => {
    const response = await fetch(
      `https://api.exchange.coinbase.com/products/${product}/stats`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<{ open: string; last: string }>;
  };
  const [btc, eth] = await Promise.all([fetchStats("BTC-USD"), fetchStats("ETH-USD")]);
  const change = (stats: { open: string; last: string }) => {
    const open = Number(stats.open);
    const last = Number(stats.last);
    return open > 0 ? ((last - open) / open) * 100 : 0;
  };
  const priceData: PriceData = {
    prices: {
      BTC: Number(btc.last) || FALLBACK_PRICES.BTC,
      ETH: Number(eth.last) || FALLBACK_PRICES.ETH,
      USDT: 1,
    },
    changes: {
      BTC: change(btc),
      ETH: change(eth),
      USDT: 0,
    },
    lastUpdated: new Date(),
  };
  return priceData;
};

/**
 * Live prices with a fallback chain: CoinGecko → Binance → Coinbase → cached → static.
 * Binance and Coinbase only quote USD; if another display currency was requested we
 * still prefer live USD prices over stale static defaults.
 */
const fetchCryptoPrices = async (currency: string): Promise<PriceData> => {
  try {
    const priceData = await fetchCoinGeckoPrices(currency);
    cachedPriceData = priceData;
    return priceData;
  } catch (error) {
    console.warn("CoinGecko API failed, trying Binance:", error);
  }

  try {
    const priceData = await fetchBinancePrices();
    cachedPriceData = priceData;
    return priceData;
  } catch (error) {
    console.warn("Binance API failed, trying Coinbase:", error);
  }

  try {
    const priceData = await fetchCoinbasePrices();
    cachedPriceData = priceData;
    return priceData;
  } catch (error) {
    console.warn("Coinbase API failed, using cached/fallback prices:", error);
  }

  if (cachedPriceData) return cachedPriceData;
  return {
    prices: FALLBACK_PRICES,
    changes: FALLBACK_CHANGES,
    lastUpdated: new Date(),
  };
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
