export interface PnlPoint {
  /** Battle index (1-based) along the trader's history. */
  battle: number;
  /** Cumulative realized PnL in SOL at this battle. */
  cumPnl: number;
}

/**
 * Deterministic sample cumulative-PnL curve for a losing trader, ending at the
 * known realized figure (-1.6493 SOL). Stands in until the live Dune query is
 * wired. No Math.random / Date.now so SSR and client agree.
 */
export function sampleTraderPnl(points = 120, endPnl = -1.6493): PnlPoint[] {
  const raw: number[] = [];
  let acc = 0;
  for (let i = 0; i < points; i++) {
    // Choppy downward drift: small wins, slightly bigger losses.
    const step =
      Math.sin(i / 7) * 0.06 + Math.cos(i / 17) * 0.05 - 0.018 + Math.sin(i / 3) * 0.03;
    acc += step;
    raw.push(acc);
  }
  // Normalize so the final cumulative equals endPnl exactly.
  const last = raw[raw.length - 1] || 1;
  const scale = endPnl / last;
  return raw.map((v, i) => ({
    battle: i + 1,
    cumPnl: Math.round(v * scale * 10000) / 10000,
  }));
}
