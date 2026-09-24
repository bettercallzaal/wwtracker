/**
 * Finding battles. The gap between "this SDK can trade a battle" and "a front
 * end can be built on it".
 *
 * Everything else here takes a battle id you already have. Nothing told you
 * where to get one. The technique - `getProgramAccounts` with a `dataSlice` -
 * has been written down in `docs/SOP.md` SOP 1 since 2026-09-19 as a procedure
 * for a human, which means every integrator reinvents it and some of them get
 * the id guard wrong.
 *
 * NO NETWORK, SAME AS THE REST OF `lib/ww`. This builds the request and parses
 * the response; the caller does the fetch. That is how `instructions.ts` works
 * and it is why this library ports to somebody else's stack without dragging a
 * HTTP client, a retry policy or an API key convention with it.
 *
 * THE dataSlice IS NOT AN OPTIMISATION, IT IS THE DIFFERENCE BETWEEN WORKING
 * AND NOT. A battle account is 353 bytes and there are over 1,600 of them, so
 * the full response is about 600 KB of base64 per call. Sliced to the first 256
 * bytes it is about 430 KB and carries every field this module reads. Public
 * RPC endpoints rate-limit on response size.
 *
 * THE ID RANGE GUARD IS LOAD-BEARING AND EASY TO MISS. The program owns
 * accounts that are not battles. A battle id is the battle's start time in unix
 * seconds, so anything outside roughly 2020 to 2052 is not one, whatever its
 * size suggests. Measured 2026-09-20: the size filter alone returns 1,694
 * accounts and the guard keeps all 1,694, so today it changes nothing - but it
 * cost nothing and the day it matters nobody will be watching.
 */
import { battleIdFromAccount, battleIsSettled } from "./claim";
import { PROGRAM_ID } from "./pda";

/** A battle account is exactly this many bytes. The cheapest filter there is. */
export const BATTLE_ACCOUNT_BYTES = 353;

/** Everything this module reads lives in the first 256 bytes. */
export const DISCOVERY_SLICE_BYTES = 256;

/**
 * WHAT 212 AND 220 ACTUALLY ARE, because this file has called them the pools
 * since it was written and the IDL disagrees.
 *
 * The Battle account carries SIX u64s in a row, and two of them are SOL per
 * side, not one:
 *
 *     196 artist_a_supply        204 artist_b_supply
 *     212 artist_a_sol_balance   220 artist_b_sol_balance
 *     228 artist_a_pool          236 artist_b_pool
 *
 * So `poolA: 212` reads `artist_a_sol_balance`. MEASURED 2026-09-24 on five
 * battles including the three largest ever run: the two fields hold the same
 * value on every side of every one of them, so nothing downstream is wrong.
 * They are read as a pair below and a disagreement is reported rather than
 * silently resolved, because "we checked once" is not a property of the code
 * and the next reader cannot tell it from a guess.
 */
const OFFSET = {
  startTime: 20,
  endTime: 28,
  solBalanceA: 212,
  solBalanceB: 220,
  poolA: 228,
  poolB: 236,
  winnerArtistA: 244,
} as const;

/**
 * The JSON-RPC body to POST at any Solana endpoint.
 *
 * Returned rather than sent. A caller with a keyed endpoint, a proxy or a rate
 * limiter keeps all three, and this stays a pure function anyone can test.
 */
/**
 * Byte 245 is `winner_decided`. A memcmp of a single zero byte there makes the
 * RPC return only battles the program has NOT settled - which is every live
 * battle, by definition, plus the ones waiting to be settled.
 *
 * MEASURED 2026-09-23 against mainnet: the unfiltered scan returns 1,702
 * accounts and 975,190 bytes in 0.31 s; with this filter, 82 accounts and
 * 47,017 bytes in 0.12 s. The watcher runs that scan every ten seconds all day
 * while waiting for a session, and after five hours of it the public endpoint
 * had begun refusing roughly a quarter of them - 61 exhausted calls, each
 * after eight retries, while `getHealth` answered in 84 ms. Twenty times less
 * data is the difference between idling politely and spending the allowance
 * before the battle starts.
 *
 * `"1"` is base58 for a single 0x00 byte, which is what this filter compares.
 */
const UNSETTLED_BYTE_FILTER = { memcmp: { offset: 245, bytes: "1" } };

export function battleDiscoveryRequest(programId: string = PROGRAM_ID, unsettledOnly = false): {
  jsonrpc: "2.0";
  id: number;
  method: "getProgramAccounts";
  params: unknown[];
} {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "getProgramAccounts",
    params: [
      programId,
      {
        encoding: "base64",
        dataSlice: { offset: 0, length: DISCOVERY_SLICE_BYTES },
        filters: unsettledOnly
          ? [{ dataSize: BATTLE_ACCOUNT_BYTES }, UNSETTLED_BYTE_FILTER]
          : [{ dataSize: BATTLE_ACCOUNT_BYTES }],
      },
    ],
  };
}

export type BattlePhase = "live" | "awaiting-settlement" | "settled";

export interface BattleSummary {
  battleId: number;
  /** The account address, so a caller can read it again without re-deriving. */
  pubkey: string;
  startTime: number;
  endTime: number;
  poolLamports: { a: number; b: number };
  /**
   * True when `artist_*_sol_balance` and `artist_*_pool` disagree on a side.
   *
   * They matched on every battle measured, so this should never be true. It
   * exists because the day it is, every quote built off the wrong one of the
   * two is wrong, and nothing else would say so.
   */
  poolDisagreesWithBalance: boolean;
  settled: boolean;
  /**
   * Which side the PROGRAM settled on: the larger pool. Null until it settles.
   *
   * NOT the judged winner. A battle has two winners and they differ on about
   * one in eight - see `battleVerification.ts`. Anything showing a scoreboard
   * wants the judged result, which is off chain and not in here.
   */
  settlementWinner: "artist_a" | "artist_b" | null;
  phase: BattlePhase;
}

/** One row as `getProgramAccounts` returns it with `encoding: "base64"`. */
export interface ProgramAccountRow {
  pubkey: string;
  account: { data: [string, string] };
}

const u64 = (v: DataView, o: number): number => Number(v.getBigUint64(o, true));

/**
 * Decode one row, or null if it is not a battle.
 *
 * Null rather than throw: a caller sweeping 1,700 accounts wants the ones that
 * decode, not an exception on the first thing the program owns that is not a
 * battle.
 */
export function parseBattleAccount(
  row: ProgramAccountRow,
  decodeBase64: (s: string) => Uint8Array,
  now: number = Math.floor(Date.now() / 1000),
): BattleSummary | null {
  let raw: Uint8Array;
  try {
    raw = decodeBase64(row.account.data[0]);
  } catch {
    return null;
  }
  if (raw.length <= OFFSET.winnerArtistA + 1) return null;

  const battleId = battleIdFromAccount(raw);
  if (battleId === null) return null;
  const settled = battleIsSettled(raw);
  if (settled === null) return null;

  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const endTime = u64(view, OFFSET.endTime);
  // The 256-byte discovery slice reaches 236, so both pairs are in range. A
  // caller passing a shorter buffer would read past it, so the length check
  // above is now load-bearing for these two as well.
  if (raw.length <= OFFSET.poolB + 7) return null;
  const poolA = u64(view, OFFSET.poolA);
  const poolB = u64(view, OFFSET.poolB);
  const balanceA = u64(view, OFFSET.solBalanceA);
  const balanceB = u64(view, OFFSET.solBalanceB);

  return {
    battleId,
    pubkey: row.pubkey,
    startTime: u64(view, OFFSET.startTime),
    endTime,
    poolLamports: { a: poolA, b: poolB },
    poolDisagreesWithBalance: poolA !== balanceA || poolB !== balanceB,
    settled,
    // On a tie the program settles to artist B - its own "Tie detected!" branch,
    // 68 of 68 tied battles on chain. This field reads the flag rather than
    // comparing pools, so it is already correct for ties; the note is here
    // because comparing pools yourself is the obvious reimplementation and it
    // would be wrong exactly 68 times.
    settlementWinner: settled ? (raw[OFFSET.winnerArtistA] !== 0 ? "artist_a" : "artist_b") : null,
    // A battle past its end time that has not settled is its own state, not a
    // live one and not a finished one. 81 accounts were in it on 2026-09-20 and
    // a claim against any of them returns BattleNotEnded.
    phase: settled ? "settled" : endTime > now ? "live" : "awaiting-settlement",
  };
}

/** Decode a whole response, dropping anything that is not a battle. */
export function parseBattleAccounts(
  rows: ProgramAccountRow[],
  decodeBase64: (s: string) => Uint8Array,
  now?: number,
): BattleSummary[] {
  const out: BattleSummary[] = [];
  for (const r of rows) {
    const b = parseBattleAccount(r, decodeBase64, now);
    if (b) out.push(b);
  }
  return out;
}

/** Trading is open. What a front end's front page wants. */
export const liveBattles = (bs: BattleSummary[]): BattleSummary[] =>
  bs.filter((b) => b.phase === "live").sort((a, b) => b.startTime - a.startTime);

/**
 * Past its end time and the program has never settled it.
 *
 * `endBattle` is permissionless, so anyone can clear these, and a claim against
 * one fails until somebody does.
 */
export const awaitingSettlement = (bs: BattleSummary[]): BattleSummary[] =>
  bs.filter((b) => b.phase === "awaiting-settlement").sort((a, b) => a.endTime - b.endTime);

/** Settled and holding SOL, which is where a claim can pay something out. */
export const settledWithValue = (bs: BattleSummary[]): BattleSummary[] =>
  bs
    .filter((b) => b.phase === "settled" && b.poolLamports.a + b.poolLamports.b > 0)
    .sort((a, b) => b.poolLamports.a + b.poolLamports.b - (a.poolLamports.a + a.poolLamports.b));

/** Counts by phase, for a caller that wants one line rather than a list. */
export function phaseCounts(bs: BattleSummary[]): Record<BattlePhase, number> {
  const c: Record<BattlePhase, number> = { live: 0, "awaiting-settlement": 0, settled: 0 };
  for (const b of bs) c[b.phase] += 1;
  return c;
}
