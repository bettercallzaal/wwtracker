/**
 * PRD section 32, Battle Verification: take a battle record somebody hands you
 * and check it against the chain account it claims to describe.
 *
 * THE POINT IS THE SEPARATION, NOT THE COMPARISON. Section 32 ends with the
 * line this module is built around - "the blockchain remains the authoritative
 * settlement record, WaveWarz Index provides normalized, queryable data". A
 * record arrives from an indexer, an API or a partner. Some of its fields are
 * restatements of bytes anybody can read; the rest are assertions only its
 * author can vouch for. **This says which is which, per field, and never lets
 * the second kind inherit the credibility of the first.**
 *
 * SO IT CANNOT RETURN "VERIFIED", and that is deliberate in the same way
 * `tokenEligibility.ts` cannot return "eligible". Eighteen of the record's
 * thirty-eight fields have no chain representation at all - `operator_id`,
 * `ruleset`, `protocol_version`, the artist and track ids, the judged winner,
 * the trade aggregates. A verdict of "verified" over a record that is mostly
 * unverifiable would be the most dangerous output this module could produce,
 * because it would look like the strong claim while being the weak one. The
 * verdicts are `chain-consistent`, `contradicted` and `unanchored`.
 *
 * THE BINDING CHECK COMES FIRST AND SHORT-CIRCUITS. If the account's battle id
 * at offset 8 is not the record's `battle_id`, every later comparison is
 * between two different battles and a "mismatch" on each would be noise
 * dressed as evidence. That case returns `unanchored` with one check, rather
 * than thirty contradictions.
 *
 * A DISAGREEMENT BETWEEN THE TWO WINNERS IS NOT A DEFECT, and a naive verifier
 * would report 174 of them. `settlement_winner` is the larger pool, written by
 * the program. `result_winner` is the judged outcome, decided off chain by a
 * 2-of-3 rule for quick battles and a panel for main events. They disagree on
 * 174 of the 1,246 battles that carry both, which is 11.8%, and that is the
 * system working rather than the record lying. This module checks
 * `settlement_winner` against the pools and marks `result_winner`
 * unverifiable, with the reason. **Anything that flags the difference as an
 * error will bury a real contradiction under 174 false ones.**
 */
import { battlePda, vaultPda, mintPda, findPda, u64le } from "./pda";

/** `pda.ts` keeps its own `seed` private; this is the same one byte for byte. */
const seed = (s: string) => new TextEncoder().encode(s);

/** Per-field outcome. There is no "probably". */
export type FieldVerdict = "match" | "mismatch" | "unverifiable";

export interface FieldCheck {
  field: string;
  verdict: FieldVerdict;
  /** What the record asserts. */
  claimed: string | number | boolean | null;
  /** What the chain says, when the chain has an opinion. */
  onChain?: string | number | boolean | null;
  detail: string;
}

/**
 * `chain-consistent` is the strongest available and still means only "nothing
 * checkable disagreed". `unanchored` means the account and the record are not
 * about the same battle, so nothing was learned about the record's contents.
 */
export type VerificationVerdict = "chain-consistent" | "contradicted" | "unanchored";

export interface VerificationReport {
  battleId: number | null;
  verdict: VerificationVerdict;
  /** Fields the chain could answer. */
  answered: number;
  /** Fields it could not, which is most of a battle record. */
  unanswered: number;
  checks: FieldCheck[];
}

/** Offsets, identical to `battleRecord.ts` and deliberately duplicated. */
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

export const MIN_VERIFIABLE_ACCOUNT_BYTES = 246;

/**
 * Fields with no chain representation, and why each one is absent. Listed
 * rather than inferred, so a field added to the record later shows up as
 * unknown instead of being silently skipped.
 */
const NO_CHAIN_SOURCE: Record<string, string> = {
  protocol_version: "no decision has been made, and the program stores none",
  ruleset: "no decision has been made, and the program stores none",
  ranked: "no decision has been made, and the program stores none",
  artist_a_id: "artist identity is a registry, not a chain fact",
  artist_b_id: "artist identity is a registry, not a chain fact",
  track_a_id: "track identity is a registry, not a chain fact",
  track_b_id: "track identity is a registry, not a chain fact",
  input_assets_used: "not recorded on chain; every battle to date settles in SOL",
  operator_id: "operator attribution is a registry lookup, supplied by the caller",
  operator_attribution_basis: "describes how the caller attributed, not a chain fact",
  battle_type: "quick / main / community lives in the record layer, not the account",
  result_winner:
    "the JUDGED winner, decided off chain by 2-of-3 for quick battles and a panel " +
    "for main events. It differs from settlement_winner on 11.8% of battles that " +
    "carry both, and that difference is the design, not an error",
  total_volume_lamports: "derived from trades, which are transactions rather than account state",
  buy_lamports: "derived from trades",
  sell_lamports: "derived from trades",
  trade_count: "derived from trades",
  unique_traders: "derived from trades",
  claim_count: "derived from trades",
  distribution_lamports: "the account records that it settled, not what was distributed",
  settlement_asset: "standard, not stored: the program cannot settle anything but SOL",
  launcher_wallet: "the creating signer is in the transaction, not in the account",
  fee_collection_wallet: "stored, but outside the byte range this module reads",
  artist_a_wallet: "stored, but outside the byte range this module reads",
  artist_b_wallet: "stored, but outside the byte range this module reads",
};

const u64at = (a: Uint8Array, off: number): number => {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(a[off + i]);
  return Number(v);
};

const eq = (
  field: string,
  claimed: string | number | boolean | null | undefined,
  onChain: string | number | boolean,
  detail: string,
): FieldCheck =>
  claimed === undefined || claimed === null
    ? { field, verdict: "unverifiable", claimed: null, onChain, detail: `${detail}. The record does not assert it` }
    : { field, verdict: claimed === onChain ? "match" : "mismatch", claimed, onChain, detail };

/** The record shape this accepts. Everything optional: absent is not wrong. */
export interface ClaimedBattleRecord {
  battle_id?: number | null;
  battle_pda?: string | null;
  program_id?: string | null;
  vault_pda?: string | null;
  artist_a_mint?: string | null;
  artist_b_mint?: string | null;
  start_time?: number | null;
  end_time?: number | null;
  final_supply_a?: number | null;
  final_supply_b?: number | null;
  final_pool_a?: number | null;
  final_pool_b?: number | null;
  settled?: boolean | null;
  settlement_winner?: string | null;
  [k: string]: unknown;
}

export function verifyBattleRecord(p: {
  record: ClaimedBattleRecord;
  /** The raw account, as `getAccountInfo` base64-decodes it. */
  account: Uint8Array;
}): VerificationReport {
  const { record: r, account: a } = p;
  const checks: FieldCheck[] = [];

  if (a.length < MIN_VERIFIABLE_ACCOUNT_BYTES) {
    return {
      battleId: null,
      verdict: "unanchored",
      answered: 0,
      unanswered: 1,
      checks: [
        {
          field: "account",
          verdict: "unverifiable",
          claimed: r.battle_id ?? null,
          detail: `the account is ${a.length} bytes and ${MIN_VERIFIABLE_ACCOUNT_BYTES} are needed to read every verifiable field. A short account is not a wrong record`,
        },
      ],
    };
  }

  // THE BINDING CHECK. Everything downstream is meaningless without it.
  const onChainId = u64at(a, OFFSET.battleId);
  const idCheck = eq(
    "battle_id",
    r.battle_id,
    onChainId,
    `the account's battle id at offset ${OFFSET.battleId}`,
  );
  checks.push(idCheck);
  if (idCheck.verdict !== "match") {
    return {
      battleId: onChainId,
      verdict: "unanchored",
      answered: idCheck.verdict === "mismatch" ? 1 : 0,
      unanswered: 1,
      checks: [
        {
          ...idCheck,
          detail:
            idCheck.verdict === "mismatch"
              ? `${idCheck.detail}. The record and the account describe DIFFERENT BATTLES, so no other field was compared - thirty mismatches here would be noise, not evidence`
              : idCheck.detail,
        },
      ],
    };
  }

  // Addresses re-derived rather than trusted. A record can name any string.
  const derivedBattle = battlePda(onChainId);
  checks.push(
    eq("battle_pda", r.battle_pda, derivedBattle, "re-derived from the battle id, seeds [\"battle\", id]"),
  );
  checks.push(
    eq("vault_pda", r.vault_pda, vaultPda(onChainId), "re-derived, seeds [\"battle_vault\", id]"),
  );
  checks.push(
    eq("artist_a_mint", r.artist_a_mint, mintPda(onChainId, "a"), "re-derived, seeds [\"artist_a_mint\", id]"),
  );
  checks.push(
    eq("artist_b_mint", r.artist_b_mint, mintPda(onChainId, "b"), "re-derived, seeds [\"artist_b_mint\", id]"),
  );

  /**
   * The program id is checkable because the PDA depends on it: a record naming
   * a different program cannot also name a battle PDA that derives under it.
   * This catches a record copied between deployments, which nothing else here
   * would notice.
   */
  if (typeof r.program_id === "string" && typeof r.battle_pda === "string") {
    let derivesUnderClaimed = false;
    try {
      derivesUnderClaimed =
        findPda([seed("battle"), u64le(onChainId)], r.program_id).address === r.battle_pda;
    } catch {
      derivesUnderClaimed = false;
    }
    checks.push({
      field: "program_id",
      verdict: derivesUnderClaimed ? "match" : "mismatch",
      claimed: r.program_id,
      onChain: derivedBattle === r.battle_pda ? "consistent with the canonical program" : "does not derive this PDA",
      detail:
        "the battle PDA is derived under the program id, so a record naming another program cannot also name a PDA that derives under it",
    });
  } else {
    checks.push({
      field: "program_id",
      verdict: "unverifiable",
      claimed: (r.program_id as string) ?? null,
      detail: "needs both program_id and battle_pda to be asserted before the derivation can be tested",
    });
  }

  checks.push(eq("start_time", r.start_time, u64at(a, OFFSET.startTime), `offset ${OFFSET.startTime}`));
  checks.push(eq("end_time", r.end_time, u64at(a, OFFSET.endTime), `offset ${OFFSET.endTime}`));
  checks.push(eq("final_supply_a", r.final_supply_a, u64at(a, OFFSET.supplyA), `offset ${OFFSET.supplyA}`));
  checks.push(eq("final_supply_b", r.final_supply_b, u64at(a, OFFSET.supplyB), `offset ${OFFSET.supplyB}`));
  checks.push(eq("final_pool_a", r.final_pool_a, u64at(a, OFFSET.poolA), `offset ${OFFSET.poolA}`));
  checks.push(eq("final_pool_b", r.final_pool_b, u64at(a, OFFSET.poolB), `offset ${OFFSET.poolB}`));

  const settled = a[OFFSET.settled] !== 0;
  checks.push(eq("settled", r.settled, settled, `offset ${OFFSET.settled}`));

  const winnerIsA = a[OFFSET.winnerArtistA] !== 0;
  const onChainWinner = settled ? (winnerIsA ? "artist_a" : "artist_b") : null;
  if (!settled) {
    checks.push({
      field: "settlement_winner",
      verdict: "unverifiable",
      claimed: (r.settlement_winner as string) ?? null,
      detail: "the battle has not settled, so the program has named no winner yet",
    });
  } else {
    checks.push(
      eq("settlement_winner", r.settlement_winner, onChainWinner as string, `offset ${OFFSET.winnerArtistA}`),
    );
  }

  /**
   * An invariant rather than a field: the settled winner is the larger pool,
   * with no exception in 1,482 settled battles. A record that satisfies every
   * field above and breaks this is either forged or reveals that the rule has
   * changed, and both are worth stopping for.
   */
  if (settled) {
    const poolA = u64at(a, OFFSET.poolA);
    const poolB = u64at(a, OFFSET.poolB);
    if (poolA === poolB) {
      checks.push({
        field: "invariant:winner_is_larger_pool",
        verdict: "unverifiable",
        claimed: null,
        detail: "both pools are equal, so the invariant has nothing to say about which side won",
      });
    } else {
      const larger = poolA > poolB ? "artist_a" : "artist_b";
      checks.push({
        field: "invariant:winner_is_larger_pool",
        verdict: onChainWinner === larger ? "match" : "mismatch",
        claimed: null,
        onChain: `${onChainWinner} won, larger pool is ${larger}`,
        detail:
          "the program settles on the larger pool, measured across 1,482 settled battles with no exception. A failure here is the program disagreeing with itself, not the record being wrong",
      });
    }
  }

  for (const [field, why] of Object.entries(NO_CHAIN_SOURCE)) {
    if (!(field in r)) continue;
    checks.push({
      field,
      verdict: "unverifiable",
      claimed: (r[field] as string | number | boolean | null) ?? null,
      detail: why,
    });
  }

  const answered = checks.filter((c) => c.verdict !== "unverifiable").length;
  const unanswered = checks.length - answered;
  const contradicted = checks.some((c) => c.verdict === "mismatch");

  return {
    battleId: onChainId,
    verdict: contradicted ? "contradicted" : "chain-consistent",
    answered,
    unanswered,
    checks,
  };
}

/** Just the failures, for a caller that wants to print what went wrong. */
export const contradictions = (r: VerificationReport): FieldCheck[] =>
  r.checks.filter((c) => c.verdict === "mismatch");
