/**
 * WHO gets there first, and whether it is the same wallet every time.
 *
 * `openingGap.ts` measured WHEN the first trade lands: a floor of 66 to 67
 * seconds after `start_time` that held across a 22-second swing in when the
 * battle actually became tradeable. A floor that tight has two very different
 * explanations and the timing alone cannot tell them apart:
 *
 *   - A MARKET. Many wallets, each hearing an announcement at about the same
 *     moment, so the earliest of many lands at a reproducible time.
 *   - ONE ACTOR. A single wallet on a timer, whose cadence IS the floor, with
 *     everyone else arriving later.
 *
 * Under the first the number describes how fast the room reacts. Under the
 * second it describes one script, and quoting it as a property of the audience
 * would be wrong. The difference is visible in one measurement nobody has
 * taken: the concentration of first buyers across battles.
 *
 * THE TRADER IS TAKEN AS THE FEE PAYER, WHICH IS A PROXY AND COULD BE WRONG.
 * `accounts[0]` of a Solana transaction is the fee payer and must have signed,
 * so on a wallet-signed trade it is the trader. It stops being the trader the
 * moment anything pays fees on somebody else's behalf: a relayer, a sponsor, a
 * session key. Our own relay never signs (`relayPolicy.ts`), so it cannot
 * appear here, but another front end could sponsor fees and every row would
 * then carry ITS address. That failure has a signature worth watching for - a
 * single wallet first in essentially every battle, which this module would
 * report as ONE ACTOR when it is really one PAYER. If that verdict ever comes
 * back, check the buy instruction's own accounts before believing it.
 *
 * THE HOUSE IS NOT A TRADER, AND THE FIRST RUN OF THIS COUNTED IT AS ONE.
 * Over the 60 most recent battles the most frequent first buyer, 20 of 56, was
 * `FNjYtw...iakq37` - the platform treasury. `lib/config.ts` has carried the
 * warning since 2026-09-06 in as many words: "NOT only a trader ... it creates
 * battles as well as trading them. Anything that treats it as a pure trader is
 * wrong." This module treated it as one, and the concentration verdict was
 * therefore partly a statement about the house.
 *
 * So `houseWallets` is a parameter, not a constant: `lib/ww` stays liftable and
 * the caller supplies the addresses it considers the platform's. The counts are
 * reported BOTH ways, because both are real questions - how often the platform
 * opens its own battles, and how concentrated the outside traders are - and
 * because a reader given only the combined number cannot recover either.
 *
 * ADDRESSES ARE PUBLIC AND THIS MODULE STILL DOES NOT DECIDE TO PUBLISH THEM.
 * Zaal's public-communication ruling of 2026-09-20 was "no wallets named, no
 * one blamed, no individual P&L". Everything here is computable from chain by
 * anybody, and this returns the counts and the shape; a caller that wants
 * addresses asks for them explicitly. A concentration finding does not need a
 * name attached to be actionable.
 */

/** One battle's first trade, reduced to what a concentration count needs. */
export interface FirstBuyerRow {
  battleId: number;
  /** The fee payer of the first trade, which on a WaveWarZ trade is the trader. */
  trader: string;
  /** Seconds from the battle becoming tradeable. Null when that clock is unknown. */
  gapFromTradeableSeconds: number | null;
}

export interface TraderTally {
  trader: string;
  battles: number;
  /** Their fastest arrival, over the battles where the tradeable clock is known. */
  fastestSeconds: number | null;
}

export interface FirstBuyerConcentration {
  /** Battles that produced a first trade with a readable trader. */
  measured: number;
  distinctTraders: number;
  /** Most battles first, then fastest. */
  tallies: TraderTally[];
  /** Battles taken by the single most frequent first buyer. */
  topTraderBattles: number;
  /** Battles whose first trade came from a wallet the caller named as the platform's. */
  houseBattles: number;
  /** The same counts over the outside traders only. Null when no house wallets were named. */
  excludingHouse: {
    measured: number;
    distinctTraders: number;
    tallies: TraderTally[];
    topTraderBattles: number;
  } | null;
}

function tally(rows: FirstBuyerRow[]): { distinct: number; tallies: TraderTally[]; top: number } {
  const byTrader = new Map<string, { battles: number; fastest: number | null }>();
  for (const r of rows) {
    const cur = byTrader.get(r.trader) ?? { battles: 0, fastest: null };
    cur.battles += 1;
    if (r.gapFromTradeableSeconds !== null) {
      // `null` means UNKNOWN, not slow. Math.min against a null coerced to 0
      // would make every unknown the fastest arrival there is.
      cur.fastest = cur.fastest === null ? r.gapFromTradeableSeconds : Math.min(cur.fastest, r.gapFromTradeableSeconds);
    }
    byTrader.set(r.trader, cur);
  }
  const tallies: TraderTally[] = [...byTrader.entries()]
    .map(([trader, v]) => ({ trader, battles: v.battles, fastestSeconds: v.fastest }))
    .sort((a, b) => b.battles - a.battles || (a.fastestSeconds ?? Infinity) - (b.fastestSeconds ?? Infinity));
  return { distinct: byTrader.size, tallies, top: tallies[0]?.battles ?? 0 };
}

export function firstBuyerConcentration(
  rows: FirstBuyerRow[],
  houseWallets: ReadonlySet<string> = new Set(),
): FirstBuyerConcentration {
  const all = tally(rows);
  const outside = rows.filter((r) => !houseWallets.has(r.trader));
  const o = tally(outside);
  return {
    measured: rows.length,
    distinctTraders: all.distinct,
    tallies: all.tallies,
    topTraderBattles: all.top,
    houseBattles: rows.length - outside.length,
    excludingHouse:
      houseWallets.size === 0
        ? null
        : { measured: outside.length, distinctTraders: o.distinct, tallies: o.tallies, topTraderBattles: o.top },
  };
}

/** A wallet address shortened for a report. Never a substitute for not publishing it. */
export const shortAddress = (a: string): string =>
  a.length <= 12 ? a : `${a.slice(0, 4)}..${a.slice(-4)}`;

/**
 * The concentration in words, framed as the question it settles.
 *
 * `topN` addresses are shortened; the rest are counted. The verdict line is
 * deliberately conditional: this measurement can rule ONE ACTOR in or out, and
 * it cannot prove the remaining population heard an announcement rather than
 * watched the chain.
 */
export function describeFirstBuyers(c: FirstBuyerConcentration, topN = 5): string[] {
  const out: string[] = [];
  if (c.measured === 0) {
    out.push("NO FIRST BUYERS READ. Nothing here says anything about concentration.");
    return out;
  }
  out.push(`${c.distinctTraders} distinct wallets made the first trade across ${c.measured} battles`);

  // The house first, because leaving it inside the trader counts is the error
  // this section exists to prevent.
  if (c.excludingHouse === null) {
    out.push(
      "NO HOUSE WALLETS NAMED, so the platform's own wallet, if it trades, is counted as a trader here.",
    );
  } else if (c.houseBattles > 0) {
    out.push(
      `THE PLATFORM'S OWN WALLET made the first trade in ${c.houseBattles} of ${c.measured} battles. ` +
        `That is the house opening its own book, not a trader arriving, and it is excluded below.`,
    );
  } else {
    out.push(`the platform's own wallet made no first trade in these ${c.measured} battles`);
  }

  const scope = c.excludingHouse ?? {
    measured: c.measured,
    distinctTraders: c.distinctTraders,
    tallies: c.tallies,
    topTraderBattles: c.topTraderBattles,
  };
  const label = c.excludingHouse === null ? "" : " (house excluded)";
  if (scope.measured === 0) {
    out.push("NO OUTSIDE TRADER was ever first, so there is no trader concentration to report.");
    return out;
  }
  out.push(
    `${scope.distinctTraders} wallets took the ${scope.measured} remaining battles${label}; ` +
      `the most frequent took ${scope.topTraderBattles} of ${scope.measured}`,
  );
  for (const t of scope.tallies.slice(0, topN)) {
    out.push(
      `  ${shortAddress(t.trader)}: ${t.battles} battle(s)` +
        (t.fastestSeconds === null ? ", fastest UNKNOWN" : `, fastest ${t.fastestSeconds}s after tradeable`),
    );
  }
  if (scope.tallies.length > topN) out.push(`  and ${scope.tallies.length - topN} more wallets`);

  // The verdict, and only the part the measurement can carry.
  if (scope.distinctTraders === 1) {
    out.push(
      "ONE WALLET is first every time, so the arrival floor is that wallet's cadence and not the room's.",
    );
  } else if (scope.topTraderBattles * 2 > scope.measured) {
    out.push(
      "ONE WALLET is first in more than half of these, so the floor is mostly its cadence. Quoting the",
    );
    out.push("floor as how fast the audience reacts would be quoting one participant.");
  } else {
    out.push(
      `NO SINGLE WALLET dominates: the fastest arrivals come from ${scope.distinctTraders} wallets, so the floor`,
    );
    out.push("is a property of the population rather than of one script.");
    out.push(
      "That does NOT establish they heard an announcement. Watching the chain produces the same rows.",
    );
  }
  return out;
}
