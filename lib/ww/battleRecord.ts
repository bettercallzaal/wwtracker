/**
 * PRD section 31, the Universal Battle Record, as a function a consumer calls.
 *
 * WHY THIS EXISTS WHEN AN EMITTER ALREADY DID. `tools/battle-record.py` in the
 * protocol repo emits this record for all 1,643 battles and has since
 * 2026-09-12. It reads our committed census, which is a file only this estate
 * has. So the record existed and was not obtainable by anyone else: an operator
 * with an RPC endpoint and a battle id had no way to produce one.
 *
 * This takes the RAW ACCOUNT as an RPC returns it. That makes the two
 * implementations genuinely independent - different language, different source,
 * same answer - and the fixture cross-checks them field by field across thirty
 * battles spanning the whole history. A disagreement fails the suite.
 *
 * THE PRD ASKS FOR 25 FIELDS, NOT 26. `STATUS.md`'s row and the Python
 * emitter's own docstring both say 26; section 31's list has 25 entries,
 * counted 2026-09-18. Neither of the two places that repeat the number derives
 * it, which is why they agree with each other and not with the document.
 *
 * WHAT IS NOT INVENTED, and this is most of the interesting part. Eight fields
 * are decisions nobody has made - `protocol_version`, `ruleset`, `ranked`, the
 * artist and track ids, `input_assets_used` - and they are null with the reason
 * in `sources`, never a plausible default. Two more, `operator_id` and the
 * judged winner, exist outside chain and are INPUTS: supply them or the record
 * says they were not supplied. A record that guesses its own ruleset is worse
 * than one that admits it has none, because the guess propagates into every
 * ranking built on top of it.
 *
 * AND A BATTLE HAS TWO WINNERS. The program's settled winner is the larger pool
 * and is on chain; the judged result comes from a 2-of-3 rule off chain, and
 * they DISAGREE on 174 of the 1,246 battles that have both. `spec/BATTLE-RECORD.md`
 * settled this: a single `winner` field would have to pick one and would
 * misreport the other. So the record carries both and PRD 31's `winner` is
 * satisfied by `settlement_winner` plus `result_winner`, not by choosing.
 */
import { b58encode } from "./pda";

/** One trade leg, as `trades.json` and any indexer would give it. */
export interface RecordTrade {
  kind: "buy" | "sell" | "claim";
  trader: string;
  lamports: number;
}

/** Facts that exist off chain. Supplied, or recorded as not supplied. */
export interface OffChainInputs {
  /** From the operator registry. Null means UNATTRIBUTED, never a default. */
  operatorId?: string | null;
  /** Her judged winner: "artist1" | "artist2" | null. */
  resultWinner?: string | null;
  /** quick / main / community, from the record layer. */
  battleType?: string | null;
}

export interface BattleRecord {
  battle_id: number;
  battle_pda: string;
  program_id: string;
  protocol_version: null;
  ruleset: null;
  operator_id: string | null;
  artist_a_id: null;
  artist_b_id: null;
  track_a_id: null;
  track_b_id: null;
  start_time: number;
  end_time: number;
  settlement_asset: "SOL";
  input_assets_used: null;
  artist_a_final_supply: number;
  artist_b_final_supply: number;
  artist_a_final_pool: number;
  artist_b_final_pool: number;
  total_volume: number | null;
  unique_traders: number | null;
  /** On chain: the larger pool. */
  settlement_winner: "artist_a" | "artist_b" | null;
  /** Off chain: the judged result. Null when not supplied. */
  result_winner: string | null;
  settled: boolean;
  /** Not on the battle account. See `sources`. */
  settlement_tx: null;
  ranked: null;
  /** The battle id IS the start time, so this is not a second fact. */
  created_at: number;
  /** Why each field holds what it holds. Every null has a reason here. */
  sources: Record<string, string>;
}

const UNSET: Record<string, string> = {
  protocol_version: "unset: nobody has defined what a protocol version is",
  ruleset: "unset: the 2-of-3 rule is documented in prose, never as an identifier",
  ranked: "unset: no classification exists on chain or in the index (PRD 7)",
  artist_a_id: "unset: artist profiles exist, no canonical artist id is assigned",
  artist_b_id: "unset: as artist_a_id",
  track_a_id: "unset: songs are keyed by permalink, no canonical track id",
  track_b_id: "unset: as track_a_id",
  input_assets_used:
    "unset: no entry adapter exists (PRD 11), so nothing but SOL has ever entered a battle",
  settlement_tx:
    "unset: the battle account records THAT it settled, not the transaction that did it. " +
    "Recovering the signature needs a history query this function does not make",
};

/**
 * Field offsets in the battle account, verified against thirty real accounts
 * spanning the whole history.
 *
 * `artist_b_final_pool` IS AT 220. The protocol repo's `battle-record.py`
 * documents it at 228 in its `field_sources` map; measured on the fixture,
 * offset 220 matches the emitter's own values 30 out of 30 and offset 228
 * matches 2 out of 30, which is coincidence on battles where both read zero.
 *
 * The emitter's RECORDS are right - it reads our parsed census and never uses
 * that offset. Only the provenance note is wrong, and a provenance note is
 * prose that nothing executes, so nothing could contradict it until something
 * parsed the bytes. Reported to the protocol repo separately.
 */
const OFFSET = {
  battleId: 8,
  startTime: 20,
  endTime: 28,
  supplyA: 196,
  supplyB: 204,
  poolA: 212,
  poolB: 220,
  winnerArtistA: 244,
  settled: 245,
} as const;

/** The shortest account that can hold every field this reads. */
export const MIN_BATTLE_ACCOUNT_BYTES = 246;

export function buildBattleRecord(p: {
  /** The account address. Not derivable from the bytes, so it is passed. */
  battlePda: string;
  programId: string;
  /** The raw account, exactly as `getAccountInfo` base64-decodes. */
  account: Uint8Array;
  /**
   * This battle's trades, for `total_volume` and `unique_traders`. OMIT rather
   * than pass an empty array when you have not fetched them: an empty array
   * means a battle nobody traded, and null means nobody looked. Those must not
   * render the same.
   */
  trades?: RecordTrade[] | null;
  offChain?: OffChainInputs;
}): BattleRecord {
  if (p.account.length < MIN_BATTLE_ACCOUNT_BYTES) {
    throw new Error(
      `battle account is ${p.account.length} bytes, need at least ${MIN_BATTLE_ACCOUNT_BYTES}`,
    );
  }
  const dv = new DataView(p.account.buffer, p.account.byteOffset, p.account.byteLength);
  const u64 = (o: number) => Number(dv.getBigUint64(o, true));
  const i64 = (o: number) => Number(dv.getBigInt64(o, true));

  const settled = p.account[OFFSET.settled] !== 0;
  const off = p.offChain ?? {};

  const sources: Record<string, string> = { ...UNSET };
  sources.battle_id = `chain: offset ${OFFSET.battleId}`;
  sources.battle_pda = "chain: the account address, supplied by the caller";
  sources.program_id = "chain: the program that owns the account, supplied by the caller";
  sources.start_time = `chain: offset ${OFFSET.startTime}`;
  sources.end_time = `chain: offset ${OFFSET.endTime}`;
  sources.artist_a_final_supply = `chain: offset ${OFFSET.supplyA}`;
  sources.artist_b_final_supply = `chain: offset ${OFFSET.supplyB}`;
  sources.artist_a_final_pool = `chain: offset ${OFFSET.poolA}`;
  sources.artist_b_final_pool = `chain: offset ${OFFSET.poolB}, verified 30/30 against the emitter`;
  sources.settled = `chain: offset ${OFFSET.settled}`;
  sources.settlement_asset =
    "standard: SOL for every battle to date, and the program cannot settle anything else";
  sources.created_at =
    "chain: equals start_time, because the battle id IS the start time. Not a second fact";

  sources.settlement_winner = settled
    ? `chain: offset ${OFFSET.winnerArtistA}, the larger pool`
    : "chain: the battle has not settled, so the program has named no winner";

  sources.result_winner =
    off.resultWinner === undefined
      ? "not supplied: the judged winner is off chain (2-of-3 for quick battles, a panel for main events) and was not passed in"
      : off.resultWinner === null
        ? "record layer: no judged result recorded for this battle"
        : "record layer: the judged winner, supplied by the caller";

  sources.operator_id =
    off.operatorId === undefined
      ? "not supplied: operator attribution is a registry lookup and was not passed in"
      : off.operatorId === null
        ? "registry: UNATTRIBUTED. Null is a result, never a default"
        : "registry: bound in the operator registry, supplied by the caller";

  const haveTrades = p.trades !== undefined && p.trades !== null;
  sources.total_volume = haveTrades
    ? "derived: buy and sell legs of the supplied trades"
    : "not supplied: no trades were passed, which is not the same as a battle nobody traded";
  sources.unique_traders = haveTrades
    ? "derived: distinct signers across the supplied trades"
    : "not supplied: as total_volume";

  return {
    battle_id: u64(OFFSET.battleId),
    battle_pda: p.battlePda,
    program_id: p.programId,
    protocol_version: null,
    ruleset: null,
    operator_id: off.operatorId ?? null,
    artist_a_id: null,
    artist_b_id: null,
    track_a_id: null,
    track_b_id: null,
    start_time: i64(OFFSET.startTime),
    end_time: i64(OFFSET.endTime),
    settlement_asset: "SOL",
    input_assets_used: null,
    artist_a_final_supply: u64(OFFSET.supplyA),
    artist_b_final_supply: u64(OFFSET.supplyB),
    artist_a_final_pool: u64(OFFSET.poolA),
    artist_b_final_pool: u64(OFFSET.poolB),
    total_volume: haveTrades
      ? p.trades!.filter((t) => t.kind !== "claim").reduce((n, t) => n + t.lamports, 0)
      : null,
    unique_traders: haveTrades
      ? new Set(p.trades!.filter((t) => t.kind !== "claim").map((t) => t.trader)).size
      : null,
    settlement_winner: settled
      ? p.account[OFFSET.winnerArtistA] !== 0
        ? "artist_a"
        : "artist_b"
      : null,
    result_winner: off.resultWinner ?? null,
    settled,
    settlement_tx: null,
    ranked: null,
    created_at: i64(OFFSET.startTime),
    sources,
  };
}

/**
 * The record's own account of itself: which fields are set, and which are not
 * and why.
 *
 * For a consumer deciding whether a record is usable for what they want. Eight
 * unset fields is not a defect to hide - it is the standard's current state,
 * and a reader who cannot see it will build a ranking on `ranked`.
 */
export function unsetFields(record: BattleRecord): Array<{ field: string; reason: string }> {
  return Object.entries(record)
    .filter(([k, v]) => k !== "sources" && (v === null || v === undefined))
    .map(([field]) => ({ field, reason: record.sources[field] ?? "no reason recorded" }))
    .sort((a, b) => a.field.localeCompare(b.field));
}
