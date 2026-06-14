// SOL/USD reference price for approximate USD display. Refresh periodically
// (CoinGecko simple price). Kept out of the generated snapshot so a data refresh
// does not clobber it.
export const SOL_USD = 70.33;
export const SOL_USD_AS_OF = "2026-06-14";

/** Format a SOL amount as an approximate USD string, e.g. "≈ $247". */
export function usd(sol: number, dp = 0): string {
  const v = sol * SOL_USD;
  return `≈ $${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}
