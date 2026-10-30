import { useQuery, keepPreviousData } from "@tanstack/react-query";

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
};

const BINANCE_SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

const COINBASE_PRODUCTS: Record<string, string> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  USDT: "USDT-USD",
};

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

const TIMEOUT_MS = 8_000;
const SEVEN_DAYS_MS = 7 * 24 * 3_600_000;

/** CoinGecko hourly sparklines for the last 7 days (single request, all cryptos). */
const fetchCoinGeckoSparklines = async (): Promise<Record<string, number[]>> => {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const out: Record<string, number[]> = {};
  for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
    const row = data.find((d: { id: string }) => d.id === id);
    const series = row?.sparkline_in_7d?.price;
    if (Array.isArray(series) && series.length > 1) out[symbol] = series;
  }
  if (!Object.keys(out).length) throw new Error("empty sparkline payload");
  return out;
};

/** Binance hourly klines → closing prices for the last 7 days (per crypto). */
const fetchBinanceSparkline = async (crypto: string): Promise<number[]> => {
  const symbol = BINANCE_SYMBOLS[crypto];
  if (!symbol) throw new Error(`no Binance symbol for ${crypto}`);
  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=168`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows: unknown[][] = await response.json();
  const closes = rows.map((row) => Number(row[4])).filter((n) => Number.isFinite(n));
  if (closes.length < 2) throw new Error("empty klines payload");
  return closes;
};

/** Coinbase hourly candles → closing prices for the last 7 days (per crypto). */
const fetchCoinbaseSparkline = async (crypto: string): Promise<number[]> => {
  const product = COINBASE_PRODUCTS[crypto];
  if (!product) throw new Error(`no Coinbase product for ${crypto}`);
  const end = Math.floor(Date.now() / 1000);
  const start = end - Math.floor(SEVEN_DAYS_MS / 1000);
  const response = await fetch(
    `https://api.exchange.coinbase.com/products/${product}/candles?granularity=3600&start=${start}&end=${end}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows: number[][] = await response.json();
  const closes = rows
    .sort((a, b) => a[0] - b[0])
    .map((row) => row[4])
    .filter((n) => Number.isFinite(n));
  if (closes.length < 2) throw new Error("empty candle payload");
  return closes;
};

/** 7-day hourly price series per crypto, with live fallbacks: CoinGecko → Binance → Coinbase. */
const fetchSparklines = async (): Promise<Record<string, number[]>> => {
  const out: Record<string, number[]> = {};

  try {
    Object.assign(out, await fetchCoinGeckoSparklines());
  } catch {
    // CoinGecko free tier rate-limits browsers often; fall through per crypto.
  }

  for (const crypto of Object.keys(COINGECKO_IDS)) {
    if (out[crypto]?.length) continue;
    try {
      out[crypto] = await fetchBinanceSparkline(crypto);
      continue;
    } catch {
      // try Coinbase next
    }
    try {
      out[crypto] = await fetchCoinbaseSparkline(crypto);
    } catch {
      // leave this crypto absent; UI shows "chart unavailable"
    }
  }

  if (!Object.keys(out).length) throw new Error("all market data sources failed");
  return out;
};

export const useMarketSparklines = () =>
  useQuery({
    queryKey: ["market-sparklines"],
    queryFn: fetchSparklines,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    staleTime: 90_000,
    gcTime: 10 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });

/** Binance 4h klines for the last 7 days (per crypto). */
const fetchBinanceCandles = async (crypto: string): Promise<Candle[]> => {
  const symbol = BINANCE_SYMBOLS[crypto];
  if (!symbol) throw new Error(`no Binance symbol for ${crypto}`);
  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=42`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows: Array<[number, string, string, string, string]> = await response.json();
  const candles = rows.map(([t, o, h, l, c]) => ({
    t,
    o: Number(o),
    h: Number(h),
    l: Number(l),
    c: Number(c),
  }));
  if (!candles.length) throw new Error("empty klines payload");
  return candles;
};

/** Coinbase 6h candles for the last 7 days (per crypto). */
const fetchCoinbaseCandles = async (crypto: string): Promise<Candle[]> => {
  const product = COINBASE_PRODUCTS[crypto];
  if (!product) throw new Error(`no Coinbase product for ${crypto}`);
  const end = Math.floor(Date.now() / 1000);
  const start = end - Math.floor(SEVEN_DAYS_MS / 1000);
  const response = await fetch(
    `https://api.exchange.coinbase.com/products/${product}/candles?granularity=21600&start=${start}&end=${end}`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows: number[][] = await response.json();
  // Coinbase candles: [time, low, high, open, close], newest first.
  const candles = rows
    .sort((a, b) => a[0] - b[0])
    .map(([t, l, h, o, c]) => ({ t: t * 1000, o, h, l, c }));
  if (!candles.length) throw new Error("empty candle payload");
  return candles;
};

/** CoinGecko 4h OHLC for the last 7 days (per crypto). */
const fetchCoinGeckoCandles = async (crypto: string): Promise<Candle[]> => {
  const id = COINGECKO_IDS[crypto];
  if (!id) throw new Error(`Unknown crypto: ${crypto}`);
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=7`,
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows: Array<[number, number, number, number, number]> = await response.json();
  return rows.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
};

/** 7-day OHLC candles per crypto, with live fallbacks: Binance → Coinbase → CoinGecko. */
const fetchCandles = async (crypto: string): Promise<Candle[]> => {
  try {
    return await fetchBinanceCandles(crypto);
  } catch {
    // try Coinbase next
  }
  try {
    return await fetchCoinbaseCandles(crypto);
  } catch {
    // try CoinGecko last
  }
  return fetchCoinGeckoCandles(crypto);
};

export const useMarketCandles = (crypto: string | null) =>
  useQuery({
    queryKey: ["market-candles", crypto],
    queryFn: () => fetchCandles(crypto as string),
    enabled: !!crypto,
    staleTime: 240_000,
    gcTime: 10 * 60_000,
    retry: 1,
    refetchInterval: 300_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
