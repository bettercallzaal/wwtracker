import type { BalanceRow } from "./dune";

/**
 * Deterministic sample series shaped like the real WaveWarZ dev wallet: starts
 * near zero in late 2024 and climbs toward the ~3.5 SOL operating floor. No
 * Math.random / Date.now so the chart is stable across SSR/CSR hydration.
 */
export function sampleBalances(days = 560): BalanceRow[] {
  const rows: BalanceRow[] = [];
  const startEpochDay = 20059; // 2024-12-01

  for (let i = 0; i < days; i++) {
    const t = i / days; // 0 -> 1 progress through the series
    // Smooth saturating climb toward ~3.7, with small deterministic wobble.
    const climb = 3.6 * (1 - Math.exp(-3.1 * t));
    const wobble = Math.sin(i / 11) * 0.06 + Math.cos(i / 29) * 0.05;
    const balance = Math.max(0.04, climb + wobble);

    const date = new Date((startEpochDay + i) * 86400_000);
    rows.push({
      block_date: date.toISOString().slice(0, 10),
      eod_sol_balance: Math.round(balance * 1000) / 1000,
    });
  }
  return rows;
}
