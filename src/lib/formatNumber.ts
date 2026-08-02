/**
 * Number formatting helpers that keep values inside their containers.
 */

/** Grouped decimal, e.g. 10,899,692.81 */
export const formatGrouped = (value: number, maxDecimals = 2, minDecimals = 2): string =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(Number.isFinite(value) ? value : 0);

/** Compact notation, e.g. 10.90M */
export const formatCompact = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

/**
 * Crypto balance that never overflows a small card.
 * Small values keep precision, large values switch to compact notation.
 */
export const formatCryptoBalance = (value: number, compactAbove = 1_000_000): string => {
  const v = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  if (abs === 0) return "0.00";
  if (abs >= compactAbove) return formatCompact(v);
  if (abs >= 1000) return formatGrouped(v, 2, 2);
  if (abs >= 1) return formatGrouped(v, 4, 2);
  return formatGrouped(v, 8, 2);
};

/** Fiat price with sane precision for both cheap and expensive assets. */
export const formatFiatPrice = (value: number, currency: string): string => {
  const v = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  const decimals = abs >= 1000 ? 0 : abs >= 1 ? 2 : 4;
  const num =
    abs >= 10_000_000
      ? formatCompact(v)
      : new Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(v);
  return `${currency} ${num}`;
};

/** Full precision string used in tooltips / title attributes. */
export const formatExact = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(
    Number.isFinite(value) ? value : 0
  );
