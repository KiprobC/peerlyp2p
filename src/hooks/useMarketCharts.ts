import { useQuery, keepPreviousData } from "@tanstack/react-query";

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
};

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/** Hourly prices for the last 7 days, per crypto (USD). Single CoinGecko request. */
const fetchSparklines = async (): Promise<Record<string, number[]>> => {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const out: Record<string, number[]> = {};
  for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
    const row = data.find((d: { id: string }) => d.id === id);
    const series = row?.sparkline_in_7d?.price;
    if (Array.isArray(series) && series.length > 1) out[symbol] = series;
  }
  return out;
};

export const useMarketSparklines = () =>
  useQuery({
    queryKey: ["market-sparklines"],
    queryFn: fetchSparklines,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 45_000,
    gcTime: 10 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });

/** 4h OHLC candles for the last 7 days, fetched only when the candle view is active. */
const fetchCandles = async (crypto: string): Promise<Candle[]> => {
  const id = COINGECKO_IDS[crypto];
  if (!id) throw new Error(`Unknown crypto: ${crypto}`);
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=7`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows: Array<[number, number, number, number, number]> = await response.json();
  return rows.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
};

export const useMarketCandles = (crypto: string | null) =>
  useQuery({
    queryKey: ["market-candles", crypto],
    queryFn: () => fetchCandles(crypto as string),
    enabled: !!crypto,
    staleTime: 120_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
