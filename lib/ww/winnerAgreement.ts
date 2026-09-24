/**
 * HOW OFTEN THE ANNOUNCED WINNER IS NOT THE ONE THE PROGRAM PAYS, per format.
 *
 * A battle has two winners and they are different questions.
 * `settlement_winner` is the larger pool, written by the program, and it is
 * what a claim pays out on. The judged winner is decided off chain - a 2-of-3
 * rule for quick battles, a panel for main events - and it is what the room is
 * told.
 *
 * `battleVerification.ts` has said since it was written that they disagree on
 * **174 of 1,246 battles, 11.8%**, and that this is the system working rather
 * than the record lying. That number is over all battles together.
 *
 * WHAT NOBODY HAD ASKED IS WHETHER THE RATE IS THE SAME PER FORMAT, and it is
 * a question about the judging method rather than about the chain: quick
 * battles and main events are decided by different procedures, so a large gap
 * between their rates would say one procedure tracks the money and the other
 * does not. Small gaps say nothing - the formats have very different sample
 * sizes and pool sizes.
 *
 * THIS IS NOT A FAIRNESS VERDICT AND MUST NOT BE READ AS ONE. A judged result
 * that differs from the pool is the intended behaviour of a judged
 * competition; if the two never disagreed, the judging would be decorative.
 * What the rate can support is a comparison between procedures, and only where
 * the samples are big enough to carry one.
 */

export interface JudgedBattle {
  battleId: number;
  /** `quick`, `main`, `community`. */
  type: string;
  /** The announced winner's name, as the public API gives it. */
  judgedWinner: string;
  /** The names of the two sides, in A-then-B order. */
  sideA: string;
  sideB: string;
}

export interface SettledBattle {
  battleId: number;
  /** Which side the program marked. Null when it has not settled. */
  settlementWinner: "artist_a" | "artist_b" | null;
  poolLamports: { a: number; b: number };
}

export type AgreementOutcome = "agree" | "disagree" | "tie" | "unsettled" | "unresolvable";

export interface AgreementRow {
  battleId: number;
  type: string;
  outcome: AgreementOutcome;
}

/**
 * Which side the judged winner names, by matching the name against the two.
 *
 * Returns null when the name matches neither or both. BOTH IS NOT A CURIOSITY:
 * a battle can run the same artist on each side, and a naive `includes` would
 * silently pick A. Anything unresolvable is counted separately rather than
 * guessed, because a guess here moves the headline rate.
 */
export function judgedSide(b: JudgedBattle): "a" | "b" | null {
  const norm = (s: string) => s.trim().toLowerCase();
  const w = norm(b.judgedWinner);
  const a = norm(b.sideA);
  const bb = norm(b.sideB);
  if (a === bb) return null;
  if (w === a) return "a";
  if (w === bb) return "b";
  return null;
}

export function compare(judged: JudgedBattle, settled: SettledBattle): AgreementOutcome {
  if (settled.settlementWinner === null) return "unsettled";
  // A TIE IS NOT A DISAGREEMENT. The program records artist B on an exactly
  // level pool - measured on 26 of 26 settled ties - and pays both sides pro
  // rata, so there is no winning side for a judge to have differed from.
  if (settled.poolLamports.a === settled.poolLamports.b) return "tie";
  const side = judgedSide(judged);
  if (side === null) return "unresolvable";
  return (settled.settlementWinner === "artist_a" ? "a" : "b") === side ? "agree" : "disagree";
}

export interface FormatAgreement {
  type: string;
  agree: number;
  disagree: number;
  tie: number;
  unsettled: number;
  unresolvable: number;
  /** Battles where both winners exist and could be compared. */
  comparable: number;
}

export function agreementByFormat(
  judged: JudgedBattle[],
  settledById: Map<number, SettledBattle>,
): FormatAgreement[] {
  const rows: AgreementRow[] = [];
  for (const j of judged) {
    const s = settledById.get(j.battleId);
    if (!s) continue;
    rows.push({ battleId: j.battleId, type: j.type, outcome: compare(j, s) });
  }
  const byType = new Map<string, FormatAgreement>();
  for (const r of rows) {
    const f =
      byType.get(r.type) ??
      { type: r.type, agree: 0, disagree: 0, tie: 0, unsettled: 0, unresolvable: 0, comparable: 0 };
    f[r.outcome] += 1;
    if (r.outcome === "agree" || r.outcome === "disagree") f.comparable += 1;
    byType.set(r.type, f);
  }
  return [...byType.values()].sort((a, b) => b.comparable - a.comparable);
}

/**
 * The rate, or null when there is nothing to divide by.
 *
 * Never a percentage of zero. A format with no comparable battles has an
 * unknown rate, not a rate of nought.
 */
export function disagreementRate(f: FormatAgreement): number | null {
  return f.comparable === 0 ? null : f.disagree / f.comparable;
}

/**
 * How often chance alone produces this many disagreements or more, given a
 * baseline rate.
 *
 * WHY THIS IS IN THE OUTPUT AND NOT LEFT TO THE READER. Measured 2026-09-24:
 * main events disagree on 28 of 178 (15.7%) against quick battles' 117 of
 * 1,245 (9.4%), and community battles on 4 of 25 (16.0%). The two higher rates
 * look alike and are not: at the quick-battle rate, 28-or-more of 178 happens
 * 0.5% of the time and 4-or-more of 25 happens 20% of the time. One is a
 * finding and the other is a coin.
 *
 * Exact, by summing binomial terms, for the same reason `firstSide.ts` does:
 * the samples that most need qualifying are the small ones, where an
 * approximation is worst.
 */
export function chanceOfAtLeast(disagree: number, comparable: number, baselineRate: number): number | null {
  if (comparable <= 0 || disagree < 0 || disagree > comparable) return null;
  if (baselineRate <= 0 || baselineRate >= 1) return null;
  let total = 0;
  // Term for k = 0, then multiplied along, so no factorial overflows.
  let term = Math.pow(1 - baselineRate, comparable);
  for (let k = 0; k <= comparable; k++) {
    if (k >= disagree) total += term;
    term = (term * (comparable - k) * baselineRate) / ((k + 1) * (1 - baselineRate));
  }
  return Math.min(1, total);
}

/**
 * IS A DISAGREEMENT JUST A CLOSE CALL? Measured: no.
 *
 * The obvious benign explanation for the judged winner differing from the pool
 * is that those were the split decisions - judges nearly tied, so which way it
 * fell is close to a coin, and the money landed on the other side. If that
 * were it, the disagreement rate would fall as the judged margin widens.
 *
 * It does not. Over 1,445 comparable battles, by the margin the judges gave:
 *
 *      0-9%    22 of 179   12.3%
 *     20-29%    9 of 144    6.2%
 *     90-99%   25 of 274    9.1%
 *
 * and no band differs from the overall 10.2% by more than chance - the closest
 * band comes out at P = 21%, the most decisive at P = 76%. **A judged win of
 * 90-plus percent goes against the money about as often as a dead heat does.**
 *
 * So the two results are closer to independent than to noisy agreement. What
 * that means is a question for whoever knows how the judging and the trading
 * relate; the measurement only rules out the comfortable answer.
 */
export interface MarginBand {
  /** Lower edge, in whole percent. The band is [from, from + width). */
  from: number;
  disagree: number;
  comparable: number;
}

/**
 * Bucket comparable battles by the judged margin.
 *
 * A battle with no margin is skipped rather than bucketed at zero: a missing
 * number is not a dead heat, and 11 of them at the closest band would be the
 * one place it changed the reading.
 */
export function marginBands(
  rows: Array<{ margin: number | null; outcome: AgreementOutcome }>,
  width = 10,
): MarginBand[] {
  const bands = new Map<number, MarginBand>();
  for (const r of rows) {
    if (r.outcome !== "agree" && r.outcome !== "disagree") continue;
    if (r.margin === null || !Number.isFinite(r.margin)) continue;
    // 100% lands in the top band rather than opening one of its own.
    const from = Math.min(100 - width, Math.floor(r.margin / width) * width);
    const b = bands.get(from) ?? { from, disagree: 0, comparable: 0 };
    b.comparable += 1;
    if (r.outcome === "disagree") b.disagree += 1;
    bands.set(from, b);
  }
  return [...bands.values()].sort((a, b) => a.from - b.from);
}

/**
 * Whether any band stands out from the overall rate.
 *
 * Returns the bands with their tails so a reader sees the qualification beside
 * the number, not instead of it. `null` for a band with nothing comparable.
 */
export function describeMarginBands(bands: MarginBand[], width = 10): string[] {
  const totalD = bands.reduce((t, b) => t + b.disagree, 0);
  const totalC = bands.reduce((t, b) => t + b.comparable, 0);
  if (totalC === 0) return ["NO COMPARABLE BATTLES CARRY A MARGIN - nothing to say about close calls."];
  const overall = totalD / totalC;
  const out = [`overall ${totalD} of ${totalC} disagree (${(overall * 100).toFixed(1)}%)`];
  for (const b of bands) {
    const rate = b.comparable === 0 ? null : b.disagree / b.comparable;
    const p = chanceOfAtLeast(b.disagree, b.comparable, overall);
    out.push(
      `  margin ${String(b.from).padStart(2)}-${b.from + width - 1}%  ` +
        `${String(b.disagree).padStart(3)} of ${String(b.comparable).padStart(4)}  ` +
        `${rate === null ? "UNKNOWN" : `${(rate * 100).toFixed(1)}%`}  ` +
        `${p === null ? "" : `(chance gives this or more ${(p * 100).toFixed(0)}% of the time)`}`,
    );
  }
  return out;
}
