import { useId, useState } from "react";
import type { Candle } from "@/hooks/useMarketCharts";
import { cn } from "@/lib/utils";

interface SparklineProps {
  prices: number[];
  positive: boolean;
  height?: number;
  formatValue: (value: number) => string;
  formatTime?: (index: number, count: number) => string;
}

/** TradingView-style area sparkline with hover crosshair. Prices must already be in display currency. */
export const MarketSparkline = ({ prices, positive, height = 76, formatValue, formatTime }: SparklineProps) => {
  const gradientId = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const n = prices.length;

  if (n < 2) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-secondary/40 text-xs text-muted-foreground" style={{ height }}>
        Chart unavailable
      </div>
    );
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || Math.abs(max) * 0.001 || 1;
  const pad = range * 0.1;
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;

  const line = prices.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p).toFixed(2)}`).join(" ");
  const area = `${line} L100,100 L0,100 Z`;
  const baselineY = y(prices[0]);
  const colorClass = positive ? "text-emerald-400" : "text-red-400";

  const hoverPrice = hoverIdx !== null ? prices[hoverIdx] : null;
  const hoverXPct = hoverIdx !== null ? x(hoverIdx) : 0;
  const hoverYPct = hoverPrice !== null ? y(hoverPrice) : 0;

  return (
    <div
      className="relative touch-none select-none"
      style={{ height }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        setHoverIdx(Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1)))));
      }}
      onPointerLeave={() => setHoverIdx(null)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("h-full w-full overflow-visible", colorClass)}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1={baselineY} x2="100" y2={baselineY} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hoverIdx !== null && (
          <line x1={hoverXPct} y1="0" x2={hoverXPct} y2="100" stroke="currentColor" strokeOpacity="0.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      {hoverIdx !== null && hoverPrice !== null && (
        <>
          <span
            className={cn("pointer-events-none absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background", colorClass, "bg-current")}
            style={{ left: `${hoverXPct}%`, top: `${hoverYPct}%` }}
          />
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/70 bg-background/95 px-2 py-1 text-center shadow-sm backdrop-blur-sm"
            style={{
              left: `${Math.min(Math.max(hoverXPct, 14), 86)}%`,
              top: `${Math.max(hoverYPct - 8, 14)}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="text-xs font-semibold tabular-nums">{formatValue(hoverPrice)}</p>
            {formatTime && <p className="text-[10px] text-muted-foreground">{formatTime(hoverIdx, n)}</p>}
          </div>
        </>
      )}
    </div>
  );
};

interface CandlesProps {
  candles: Candle[];
  height?: number;
  formatValue: (value: number) => string;
  formatTime?: (candle: Candle) => string;
}

/** TradingView-style candlestick chart with hover crosshair. Candles must already be in display currency. */
export const MarketCandleChart = ({ candles, height = 76, formatValue, formatTime }: CandlesProps) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const n = candles.length;

  if (n < 1) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-secondary/40 text-xs text-muted-foreground" style={{ height }}>
        Chart unavailable
      </div>
    );
  }

  const lows = candles.map((c) => c.l);
  const highs = candles.map((c) => c.h);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || Math.abs(max) * 0.001 || 1;
  const pad = range * 0.1;
  const lo = min - pad;
  const hi = max + pad;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const slot = 100 / n;
  const bodyW = slot * 0.55;

  const hoverCandle = hoverIdx !== null ? candles[hoverIdx] : null;
  const hoverXPct = hoverIdx !== null ? hoverIdx * slot + slot / 2 : 0;
  const hoverYPct = hoverCandle ? y(hoverCandle.c) : 0;

  return (
    <div
      className="relative touch-none select-none"
      style={{ height }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        setHoverIdx(Math.min(n - 1, Math.max(0, Math.floor(ratio * n))));
      }}
      onPointerLeave={() => setHoverIdx(null)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const cx = i * slot + slot / 2;
          const top = y(Math.max(c.o, c.c));
          const bottom = y(Math.min(c.o, c.c));
          return (
            <g key={c.t} className={up ? "stroke-emerald-400 fill-emerald-400" : "stroke-red-400 fill-red-400"}>
              <line x1={cx} y1={y(c.h)} x2={cx} y2={y(c.l)} strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <rect x={cx - bodyW / 2} y={top} width={bodyW} height={Math.max(bottom - top, 0.6)} fillOpacity="0.9" />
            </g>
          );
        })}
        {hoverIdx !== null && (
          <line x1={hoverXPct} y1="0" x2={hoverXPct} y2="100" className="stroke-muted-foreground" strokeOpacity="0.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      {hoverCandle && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/70 bg-background/95 px-2 py-1 text-center shadow-sm backdrop-blur-sm"
          style={{
            left: `${Math.min(Math.max(hoverXPct, 16), 84)}%`,
            top: `${Math.max(hoverYPct - 8, 14)}%`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-xs font-semibold tabular-nums">{formatValue(hoverCandle.c)}</p>
          {formatTime && <p className="text-[10px] text-muted-foreground">{formatTime(hoverCandle)}</p>}
        </div>
      )}
    </div>
  );
};
