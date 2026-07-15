// Pure data-shaping helpers for Dune query results. Split out of dune.ts so
// this logic - the part most likely to break silently on a schema change -
// can be unit-tested directly without pulling in the server-only network
// client (dune.ts imports "server-only", which has no real npm package and
// can't resolve outside Next's build pipeline).

export interface BalanceRow {
  /** YYYY-MM-DD */
  block_date: string;
  /** End-of-day (closing) balance. Native SOL or SPL, already decimal-adjusted. */
  eod_sol_balance: number;
  /** Intraday high for the day (peaks that get skimmed before close). */
  day_high?: number;
}

export function toNumber(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The query may surface the balance under different column names depending on
 * whether it ran for native SOL or an SPL mint. Accept the known aliases and
 * normalize to BalanceRow.
 */
export function normalizeRows(raw: unknown): BalanceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): BalanceRow | null => {
      if (!r || typeof r !== "object") return null;
      const row = r as Record<string, unknown>;
      const date = row.block_date;
      if (typeof date !== "string") return null;
      const balance =
        row.eod_sol_balance ??
        row.eod_token_balance ??
        row.eod_balance ??
        row.balance;
      const eod = toNumber(balance);
      const high = row.day_high != null ? toNumber(row.day_high) : eod;
      return {
        block_date: date.slice(0, 10),
        eod_sol_balance: eod,
        day_high: high,
      };
    })
    .filter((r): r is BalanceRow => r !== null)
    .sort((a, b) => a.block_date.localeCompare(b.block_date));
}
