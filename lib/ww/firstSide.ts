/**
 * Did the wallet that went first end up on the larger pool.
 *
 * `openingGap.ts` found the arrival floor; `firstBuyer.ts` found that two
 * wallets account for 39 of 56 first trades, one of them the house. Both
 * describe WHO and WHEN. Neither says whether being first is worth anything,
 * and without that the concentration is a curiosity rather than a finding.
 *
 * THE HIT RATE HERE IS NOT A SKILL MEASUREMENT, AND READING IT AS ONE WOULD BE
 * WRONG IN A SPECIFIC WAY. The program settles on the larger pool, and the
 * first buy is the first money in that pool. So the first buyer does not only
 * predict the outcome, it MOVES it - on a battle whose whole pool is small,
 * a single opening buy can be most of the margin. A hit rate above half is
 * therefore consistent with skill, with self-fulfilment, and with any mixture,
 * and this module reports it without choosing between them.
 *
 * What it CAN do is size the effect against the battles where self-fulfilment
 * is least plausible: the ones whose final pools are far apart, where the
 * opening buy was a small fraction of the winning margin. That split is
 * reported separately, because a rate over all battles hides it.
 *
 * NO WALLET IS NAMED AND NO PROFIT IS COMPUTED. Zaal's public-communication
 * ruling of 2026-09-20 was "no wallets named, no one blamed, no individual
 * P&L". A side and an outcome need none of those.
 */

/** One battle's opening move against how the program settled it. */
export interface FirstSideRow {
  battleId: number;
  /** The side the first buy landed on. */
  side: "a" | "b";
  /** Lamports that buy put in. Used only to size it against the final margin. */
  amountLamports: number;
  poolALamports: number;
  poolBLamports: number;
}

export type FirstSideOutcome = "hit" | "miss" | "tie" | "empty";

export function outcomeOf(r: FirstSideRow): FirstSideOutcome {
  if (r.poolALamports === 0 && r.poolBLamports === 0) return "empty";
  if (r.poolALamports === r.poolBLamports) return "tie";
  const winner = r.poolALamports > r.poolBLamports ? "a" : "b";
  return r.side === winner ? "hit" : "miss";
}

/** The winning margin, and what fraction of it the opening buy was. */
export function marginShare(r: FirstSideRow): number | null {
  const margin = Math.abs(r.poolALamports - r.poolBLamports);
  // A zero margin is a tie, where "what fraction of the margin" has no answer.
  // Returning 0 or 1 here would put ties at one end of the distribution.
  if (margin === 0) return null;
  return r.amountLamports / margin;
}

export interface FirstSideReport {
  rows: number;
  hits: number;
  misses: number;
  ties: number;
  empties: number;
  /**
   * The same counts over battles where the opening buy was a small part of the
   * final margin, so self-fulfilment is the least plausible explanation.
   */
  decisive: { threshold: number; rows: number; hits: number; misses: number };
}

/**
 * `decisiveBelow` is the largest share of the winning margin the opening buy
 * may be for a battle to count as decisive. 0.25 by default: the opening buy
 * was at most a quarter of the gap, so three quarters of it came from
 * elsewhere.
 */
export function firstSideReport(rows: FirstSideRow[], decisiveBelow = 0.25): FirstSideReport {
  let hits = 0;
  let misses = 0;
  let ties = 0;
  let empties = 0;
  let dRows = 0;
  let dHits = 0;
  let dMisses = 0;
  for (const r of rows) {
    const o = outcomeOf(r);
    if (o === "hit") hits++;
    else if (o === "miss") misses++;
    else if (o === "tie") ties++;
    else empties++;
    if (o !== "hit" && o !== "miss") continue;
    const share = marginShare(r);
    if (share === null || share > decisiveBelow) continue;
    dRows++;
    if (o === "hit") dHits++;
    else dMisses++;
  }
  return {
    rows: rows.length,
    hits,
    misses,
    ties,
    empties,
    decisive: { threshold: decisiveBelow, rows: dRows, hits: dHits, misses: dMisses },
  };
}

/**
 * How often a fair coin produces this many hits or more, out of n.
 *
 * WHY THIS IS IN THE OUTPUT AND NOT LEFT TO THE READER. The first run of this
 * returned 28 of 52 overall - a coin flip - and 9 of 12 in the subset where
 * self-fulfilment is least plausible. "9 of 12" reads like a finding. A fair
 * coin does that or better about 7 times in 100, so it is not one. A count
 * printed without its small-sample behaviour invites exactly the reading the
 * number cannot support.
 *
 * Exact, by summing binomial terms, because n here is small and an
 * approximation would be worst precisely where the sample is thinnest.
 */
export function coinTailProbability(hits: number, n: number): number | null {
  if (n <= 0 || hits < 0 || hits > n) return null;
  // C(n,k) built multiplicatively so nothing overflows on the way to a ratio.
  let term = Math.pow(0.5, n);
  let total = 0;
  for (let k = 0; k <= n; k++) {
    if (k >= hits) total += term;
    term = (term * (n - k)) / (k + 1);
  }
  return Math.min(1, total);
}

/** The tail as a sentence, or null when the count is not worth qualifying. */
function coinNote(hits: number, n: number): string | null {
  const p = coinTailProbability(hits, n);
  if (p === null) return null;
  const pct = p < 0.01 ? "<1" : String(Math.round(p * 100));
  return `a fair coin gives ${hits} or more of ${n} about ${pct}% of the time`;
}

export function describeFirstSide(r: FirstSideReport): string[] {
  const out: string[] = [];
  if (r.rows === 0) {
    out.push("NO OPENING SIDES READ. Nothing here says whether going first picks the winner.");
    return out;
  }
  const decided = r.hits + r.misses;
  out.push(`${r.rows} battles with a readable opening buy`);
  if (decided === 0) {
    out.push(
      `NONE of them settled with one pool larger (${r.ties} tie(s), ${r.empties} with no money), so there is`,
    );
    out.push("no hit rate to report.");
    return out;
  }
  out.push(
    `the first buy was on the larger final pool in ${r.hits} of ${decided} decided battles` +
      (r.ties > 0 || r.empties > 0
        ? ` (${r.ties} tie(s) and ${r.empties} empty battle(s) excluded, they have no larger pool)`
        : ""),
  );
  const overallNote = coinNote(r.hits, decided);
  if (overallNote) out.push(`  ${overallNote}`);
  const d = r.decisive;
  if (d.rows === 0) {
    out.push(
      `NO BATTLE had an opening buy under ${Math.round(d.threshold * 100)}% of its final margin, so every hit`,
    );
    out.push("above is one the opening buy could itself account for. The rate says nothing about skill.");
  } else {
    out.push(
      `where the opening buy was under ${Math.round(d.threshold * 100)}% of the final margin: ` +
        `${d.hits} of ${d.rows}`,
    );
    const note = coinNote(d.hits, d.rows);
    if (note) out.push(`  ${note}`);
  }
  out.push(
    "THE FIRST BUY MOVES THE OUTCOME IT IS BEING SCORED AGAINST: the program settles on the larger pool",
  );
  out.push(
    "and this buy is the first money in one. A rate above half fits skill, self-fulfilment, or any mix.",
  );
  return out;
}
