/**
 * PRD 33 and 34: what an indexer must cover, and which of it an indexer is
 * allowed to be the authority for.
 *
 * SECTION 33 ENDS WITH THE LINE THIS MODULE EXISTS TO ENFORCE: "the indexer is
 * a query and normalization layer, never the authority for canonical
 * settlement." Section 34 then lists seventeen things it should index. Those
 * two statements are usually read separately, and together they say something
 * sharper: **some of the seventeen are chain facts an indexer merely restates,
 * and the rest are the indexer's own word.** Nothing had ever written down
 * which is which.
 *
 * WHY THAT MATTERS MORE THAN COVERAGE. A consumer looking at an indexer's
 * battle row cannot tell, from the row, whether `winner` is a restatement of
 * byte 244 or a judgement made off chain. Both render as a string. This estate
 * lost two days to exactly that: `winnerDecided` from the public API and the
 * program's settled byte are different facts and the API presents one of them.
 *
 * SO THE REPORT IS TWO COLUMNS, NOT ONE. Covered or not, and authoritative or
 * not. An indexer scoring 17 of 17 on coverage while claiming authority over
 * settlement is worse than one scoring 12 and saying so.
 *
 * IT SCORES WHAT IT IS TOLD. This takes an observation - which requirements a
 * caller found evidence for - and reports. It does not fetch, because an
 * indexer's shape is its own and no library can guess where it keeps its
 * fields. `scripts/ww-indexer-report.ts` shows the observation being built for
 * a real one.
 */

/** Which source is entitled to settle an argument about a requirement. */
export type Authority = "chain" | "indexer" | "operator";

export interface Requirement {
  id: string;
  /** PRD 34's own wording. */
  label: string;
  authority: Authority;
  /** Why that source and not another. */
  note: string;
}

/**
 * The seventeen, in PRD 34's order, each assigned an authority.
 *
 * **13 are chain facts.** An indexer may serve them and may not be believed
 * over the program when they disagree. **3 are the indexer's own** - they
 * exist nowhere else and it is the only source. **1 belongs to the operator
 * registry**, which is a third thing again: not chain, not the indexer.
 *
 * Those three numbers are counted from the list below, not asserted beside it.
 * A first draft of this comment said eleven, four and two from memory; the test
 * that asserts them against the data is what caught it, which is the reason the
 * test asserts them at all.
 */
export const INDEXER_REQUIREMENTS: Requirement[] = [
  { id: "battle_creation", label: "Battle creation", authority: "chain",
    note: "initializeBattle is a transaction; the account exists or it does not" },
  { id: "mint_initialization", label: "Mint initialization", authority: "chain",
    note: "both mints are PDAs derived from the battle id and can be re-derived" },
  { id: "buys", label: "Buys", authority: "chain",
    note: "buyShares transactions. The full curve state is reconstructible from them, which is what makes re-indexing possible at all" },
  { id: "sells", label: "Sells", authority: "chain",
    note: "sellShares transactions. A sell pays the same 1.5% as a buy, taken from the proceeds rather than the pool" },
  { id: "pool_changes", label: "Pool changes", authority: "chain",
    note: "offsets 212 and 220 of the battle account" },
  { id: "token_supply", label: "Token supply", authority: "chain",
    note: "offsets 196 and 204. Supply and pool move together on the curve, so either one implies the other" },
  { id: "fees", label: "Fees", authority: "chain",
    note: "1.500% of what crosses the vault, split 67/33, measured at exact lamports on both legs" },
  { id: "artist_payouts", label: "Artist payouts", authority: "chain",
    note: "transfers to the artist wallet inside each trade transaction" },
  { id: "battle_end", label: "Battle end", authority: "chain",
    note: "byte 245, which the program's IDL names `winner_decided` - the SAME name an indexer uses, not a different concept. There is no field called `settled` on the account. Measured 2026-09-20: of 40 such battles readable from wavewarz.info, 22 report winnerDecided true while the chain byte is 0" },
  { id: "winner", label: "Winner", authority: "indexer",
    note: "THE JUDGED winner is off chain - 2-of-3 for quick battles, a panel for main events. " +
      "The SETTLEMENT winner at offset 244 is a chain fact and a different question; they differ " +
      "on about one battle in eight" },
  { id: "claims", label: "Claims", authority: "chain",
    note: "claimShares transactions; the tokens are burned, so a zero balance is the confirmation" },
  { id: "settlement", label: "Settlement", authority: "chain",
    note: "PRD 33: the indexer is never the authority for this one, by name" },
  { id: "operator_attribution", label: "Operator attribution", authority: "operator",
    note: "a registry lookup. Null is a result, never a default" },
  { id: "currencies_used", label: "Currencies used", authority: "chain",
    note: "every battle to date settles in SOL and the program cannot settle anything else" },
  { id: "swap_activity", label: "Swap activity", authority: "indexer",
    note: "outside the program entirely; only an indexer watching other venues can see it" },
  { id: "final_records", label: "Final records", authority: "indexer",
    note: "a normalized record is the indexer's product. Its chain-derived fields remain checkable" },
  { id: "reindex_from_history", label: "Deterministic re-indexing from chain history", authority: "chain",
    note: "PRD 34's closing line. If it cannot be rebuilt from chain, chain was not the source" },
];

export type CoverageState = "covered" | "absent" | "partial";

export interface Observation {
  /** Requirement id to what the caller found. */
  [requirementId: string]: CoverageState | undefined;
}

export interface CoverageRow extends Requirement {
  state: CoverageState;
  /**
   * True when the indexer serves a field the chain is authoritative for.
   *
   * Not a fault. It is the normal and useful case - it is why an indexer
   * exists. It is flagged so a consumer knows which numbers to re-check
   * against the program when they matter.
   */
  restatesChain: boolean;
}

export interface CoverageReport {
  rows: CoverageRow[];
  covered: number;
  absent: number;
  partial: number;
  /** Of the covered rows, how many the chain can settle an argument about. */
  chainCheckable: number;
  /** Covered rows where the indexer is the only source. */
  indexerOnly: number;
  /**
   * Requirements PRD 33 names as never the indexer's to own, that this indexer
   * serves. Always worth printing, never an accusation.
   */
  authorityWarnings: string[];
}

export function assessIndexerCoverage(observed: Observation): CoverageReport {
  const rows: CoverageRow[] = INDEXER_REQUIREMENTS.map((r) => {
    const state = observed[r.id] ?? "absent";
    return { ...r, state, restatesChain: state !== "absent" && r.authority === "chain" };
  });
  const by = (s: CoverageState) => rows.filter((r) => r.state === s).length;
  return {
    rows,
    covered: by("covered"),
    absent: by("absent"),
    partial: by("partial"),
    chainCheckable: rows.filter((r) => r.restatesChain).length,
    indexerOnly: rows.filter((r) => r.state !== "absent" && r.authority === "indexer").length,
    authorityWarnings: rows
      .filter((r) => r.state !== "absent" && (r.id === "settlement" || r.id === "battle_end"))
      .map(
        (r) =>
          `${r.label}: served by the indexer, and PRD 33 names the program as the authority. ` +
          `Re-read it from chain before relying on it.`,
      ),
  };
}

/** One line per requirement, for a caller that wants to print the report. */
export function formatCoverage(rep: CoverageReport): string[] {
  return rep.rows.map((r) => {
    const mark = r.state === "covered" ? "yes" : r.state === "partial" ? "partial" : "no";
    return `${mark.padEnd(8)} ${r.label.padEnd(44)} authority: ${r.authority}`;
  });
}
