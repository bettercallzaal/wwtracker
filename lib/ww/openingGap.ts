/**
 * How long after a battle opens on chain does the first trade land.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT THE MARKER TERMINAL. The 45-second
 * announcement lag has been the open fairness question since 2026-09-21, and
 * `windowReport.ts` measures it properly: chain open, a mark typed the moment
 * the host announced the round, and the trades in between. That needs somebody
 * to type during a live Space while also trading. FOUR scheduled sessions have
 * now passed and `~/zao-vault/projects/` holds no `ww-45s-marks-*.log` at all,
 * so the properly-measured number does not exist and nothing in the data
 * substitutes for it.
 *
 * This measures a DIFFERENT quantity that needs nobody: the gap between a
 * battle's `start_time` and its first buy or sell on chain. It has been
 * available for every battle ever run, the whole time.
 *
 * WHAT IT BOUNDS AND WHAT IT DOES NOT. Nobody can trade a battle before they
 * know it exists, so the first trade cannot precede the earliest knowledge of
 * the opening. That makes this gap an UPPER BOUND on how long the fastest
 * participant took to find out, and nothing more:
 *
 *   - A small gap proves somebody knew early. It does not say how: they may
 *     have been watching the chain rather than listening to the room.
 *   - A large gap proves nothing at all. It is equally consistent with a late
 *     announcement and with an announcement nobody acted on.
 *
 * So a distribution of these gaps answers one question honestly - IS there a
 * population trading inside the announcement window - and refuses the other.
 * It is not a substitute for the marks, and a reader who treats it as one will
 * quote a lag that was never measured. Both numbers are wanted; only this one
 * can be had retroactively.
 *
 * TWO CLOCKS, AND THE FIRST DRAFT USED ONLY ONE. `start_time` equals the battle
 * id, which is minted BEFORE the battle exists on chain. Launching is two
 * instructions (memory: launching-is-two-steps), and **no trade is possible
 * until `initializeMints` lands**, because until then the mints a buy needs do
 * not exist. Probed 2026-09-23 on three battles:
 *
 *     battle       InitializeBattle  InitializeMints  first buy
 *     1789948124   +27s              +32s             +66s
 *     1789442838   +5s               +10s             +66s
 *     1789177998   +5s               +10s             +67s
 *
 * So a gap measured from `start_time` charges the launcher's own latency to the
 * trader, and that latency is not constant: 32s on one battle and 10s on the
 * other two. Measured from when trading was actually POSSIBLE, the same three
 * gaps are 34s, 56s and 57s, not 66s, 66s and 67s.
 *
 * BOTH are reported, because the difference between them is itself the finding.
 *
 * THE FIRST READING OF THAT DIFFERENCE WAS WRONG, AND THE CORRECTION IS THE
 * WHOLE POINT OF THIS PARAGRAPH. This file said: the first buy sits at 66 to
 * 67 seconds after `start_time` on all three battles despite the mints being
 * ready 22 seconds apart, so "whatever the first buyer is timing off tracks
 * the id's timestamp, not the moment the battle became tradeable."
 *
 * There is no such buyer. **The program refuses every buy until `start_time` +
 * 60 seconds** - measured 2026-09-24, see `tradeWindow.ts`, where 59 seconds
 * is refused and 60 is accepted. No trade CAN land earlier, so the floor is
 * the protocol's and not the population's, and 60s of gate plus a few seconds
 * of propagation is exactly the 66s observed. The earlier reading invented an
 * actor to explain a constant, which is the failure this repo is supposed to
 * be good at catching.
 *
 * So the tradeable moment is the LATER of the mints landing and the gate
 * opening, and `gapFromTradeableSeconds` is measured from that. Against the
 * mints alone it was too generous by however much of the gate remained.
 */

import { bindingConstraint, tradeableFrom, BUY_OPENS_AFTER_START_SECONDS } from "./tradeWindow";

/** A battle's opening, as the account records it. */
export interface Opening {
  battleId: number;
  /** Unix seconds, the account's `start_time`. */
  startTime: number;
  /** Unix seconds, the account's `end_time`. */
  endTime: number;
  /**
   * Unix seconds of the `initializeMints` transaction: the first moment a buy
   * could land. Null when it was not found, which is NOT the same as zero and
   * must never be defaulted to `startTime`.
   */
  mintsReadyTime: number | null;
}

/** One trade found on chain, already classified as a buy or a sell. */
export interface FirstTrade {
  signature: string;
  /** Unix seconds from the ledger, not from this machine. */
  blockTime: number;
  kind: "buy" | "sell";
  /**
   * The transaction's fee payer, which on a WaveWarZ trade is the trader.
   * Optional because a caller that only wants timings should not have to
   * invent one; `firstBuyer.ts` is what consumes it.
   */
  trader?: string;
  /** On a buy, the side it landed on, from the instruction's own bytes. */
  side?: "a" | "b";
  /** On a buy, the lamports it spent. Used to size it against the final margin. */
  amountLamports?: number;
}

export interface OpeningGap {
  battleId: number;
  /** Seconds from `start_time` to the first trade. Negative if a trade preceded the recorded open. */
  gapSeconds: number;
  /**
   * Seconds from `initializeMints` to the first trade: the gap with the
   * launcher's own latency taken out, and the only one of the two that bounds
   * how long a battle sat tradeable and untraded. Null when the mints
   * transaction was not found.
   */
  gapFromTradeableSeconds: number | null;
  startTime: number;
  mintsReadyTime: number | null;
  firstTrade: FirstTrade;
}

/**
 * Battles whose first trade could not be established, and the reason, kept
 * beside the ones that could.
 *
 * A gap report that silently drops these is the defect this repo keeps finding:
 * a battle nobody could measure and a battle nobody traded produce the same
 * empty row unless the difference is written down.
 */
export type OpeningGapMiss =
  | { battleId: number; reason: "no-trades" }
  | { battleId: number; reason: "unreadable"; detail: string };

export interface OpeningGapReport {
  gaps: OpeningGap[];
  missed: OpeningGapMiss[];
  /** Every battle asked about, whether or not it produced a gap. */
  asked: number;
}

export function buildOpeningGaps(
  openings: Opening[],
  firstTrades: Map<number, FirstTrade | null>,
  unreadable: Map<number, string> = new Map(),
): OpeningGapReport {
  const gaps: OpeningGap[] = [];
  const missed: OpeningGapMiss[] = [];
  for (const o of openings) {
    const why = unreadable.get(o.battleId);
    if (why !== undefined) {
      missed.push({ battleId: o.battleId, reason: "unreadable", detail: why });
      continue;
    }
    // `has` rather than a truthiness test: a battle we never asked about and a
    // battle that answered "no trades" are different facts, and `?? null`
    // collapses them.
    if (!firstTrades.has(o.battleId)) {
      missed.push({ battleId: o.battleId, reason: "unreadable", detail: "never fetched" });
      continue;
    }
    const t = firstTrades.get(o.battleId);
    if (t === null || t === undefined) {
      missed.push({ battleId: o.battleId, reason: "no-trades" });
      continue;
    }
    gaps.push({
      battleId: o.battleId,
      gapSeconds: t.blockTime - o.startTime,
      gapFromTradeableSeconds: (() => {
        const from = tradeableFrom(o.startTime, o.mintsReadyTime);
        return from === null ? null : t.blockTime - from;
      })(),
      startTime: o.startTime,
      mintsReadyTime: o.mintsReadyTime,
      firstTrade: t,
    });
  }
  return { gaps, missed, asked: openings.length };
}

/** The percentile of a sorted-on-demand sample. Returns null on an empty one. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * How many gaps fall inside a window, as a count AND its denominator.
 *
 * Never a bare percentage: CLAUDE.md's rule is that a ratio without its
 * denominator is a missing measurement.
 */
export function countWithin(gaps: OpeningGap[], seconds: number): { within: number; of: number } {
  return { within: gaps.filter((g) => g.gapSeconds <= seconds).length, of: gaps.length };
}

/**
 * The report in words.
 *
 * `windowSeconds` is the announcement lag being tested against, 45 by default
 * because that is the figure in circulation. Every line names what it is a
 * bound on, because the whole hazard of this measurement is being read as the
 * lag itself.
 */
export function describeOpeningGaps(r: OpeningGapReport, windowSeconds = 45): string[] {
  const out: string[] = [];
  out.push(
    `${r.gaps.length} of ${r.asked} battles gave a first trade on chain` +
      (r.missed.length > 0 ? `, ${r.missed.length} did not` : ""),
  );
  if (r.gaps.length === 0) {
    out.push("NO GAPS MEASURED. Nothing below is a statement about the announcement lag.");
    for (const m of r.missed) {
      out.push(
        m.reason === "no-trades"
          ? `  ${m.battleId}: no buy or sell found`
          : `  ${m.battleId}: could not read - ${m.detail}`,
      );
    }
    return out;
  }
  const values = r.gaps.map((g) => g.gapSeconds);
  const fast = countWithin(r.gaps, windowSeconds);
  out.push(
    `from start_time to first trade: median ${percentile(values, 50)}s, ` +
      `fastest ${Math.min(...values)}s, slowest ${Math.max(...values)}s ` +
      `(p10 ${percentile(values, 10)}s, p90 ${percentile(values, 90)}s)`,
  );
  out.push(
    `${fast.within} of ${fast.of} battles saw their first trade within ${windowSeconds}s of start_time`,
  );

  // The second clock, and the honest one for "could anybody have traded
  // sooner". start_time is the battle id, minted before the battle exists; no
  // buy is possible until initializeMints lands, and that latency varies.
  const tradeable = r.gaps.filter(
    (g): g is OpeningGap & { gapFromTradeableSeconds: number } => g.gapFromTradeableSeconds !== null,
  );
  if (tradeable.length === 0) {
    out.push(
      "TRADEABLE OPEN UNKNOWN for every battle here: no initializeMints transaction was found, so the",
    );
    out.push(
      "gaps above still carry the launcher's own latency and are not a statement about traders.",
    );
  } else {
    const tv = tradeable.map((g) => g.gapFromTradeableSeconds);
    const within = tradeable.filter((g) => g.gapFromTradeableSeconds <= windowSeconds).length;
    const bound = tradeable.map((g) => bindingConstraint(g.startTime, g.mintsReadyTime));
    const byGate = bound.filter((b) => b === "gate").length;
    out.push(
      `the program refuses every buy until start_time + ${BUY_OPENS_AFTER_START_SECONDS}s, so that gate and not the`,
    );
    out.push(
      `mints is what opened trading on ${byGate} of ${tradeable.length} of these. The floor above is the protocol's.`,
    );
    out.push(
      `from the first moment a buy could land to the first trade: ` +
        `median ${percentile(tv, 50)}s, fastest ${Math.min(...tv)}s, slowest ${Math.max(...tv)}s, ` +
        `over ${tradeable.length} of ${r.gaps.length} battles`,
    );
    out.push(`${within} of ${tradeable.length} of those traded within ${windowSeconds}s of becoming tradeable`);
    const launch = tradeable.map((g) => (g.mintsReadyTime as number) - g.startTime);
    out.push(
      `the launch itself took median ${percentile(launch, 50)}s ` +
        `(${Math.min(...launch)}s to ${Math.max(...launch)}s), which the first figure charges to traders`,
    );
  }
  out.push(
    "This is an UPPER BOUND on how fast the earliest participant knew, not the announcement lag.",
  );
  out.push(
    "A small gap proves somebody knew early, not how. A large gap proves nothing: it fits a late",
  );
  out.push(
    "announcement and an announcement nobody acted on equally. The lag itself still needs the marks",
  );
  out.push("from scripts/ww-mark.sh, and no marks file exists yet.");
  const noTrades = r.missed.filter((m) => m.reason === "no-trades").length;
  const unread = r.missed.filter((m) => m.reason === "unreadable").length;
  if (noTrades > 0) out.push(`${noTrades} battles had no buy or sell at all`);
  if (unread > 0) {
    out.push(`${unread} battles COULD NOT BE READ, which is a gap in the instrument, not a finding:`);
    for (const m of r.missed) {
      if (m.reason === "unreadable") out.push(`  ${m.battleId}: ${m.detail}`);
    }
  }
  return out;
}
