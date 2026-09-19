/**
 * PRD section 16, the Approved Asset Registry: one row per asset WaveWarZ will
 * accept, and the refusal to invent any part of it.
 *
 * THIS IS WHERE POLICY LIVES, and that is a deliberate division with
 * `tokenEligibility.ts`. The checker reads chain and reports hazards; it was
 * built without a policy argument on purpose, so that "is a freeze authority
 * disqualifying for a payout asset" could not be buried inside something that
 * looks like it is reading data. The answer to that question belongs here, in
 * `status`, written by a person.
 *
 * SO EIGHT OF THE SIXTEEN FIELDS ARE REQUIRED INPUTS AND HAVE NO DEFAULTS.
 * `operator_id`, `entry_enabled`, `exit_enabled`, `minimum_liquidity`,
 * `maximum_price_impact`, `maximum_slippage`, `routing_status` and `status` are
 * policy or market data. `buildAssetRegistryRow` THROWS when one is missing,
 * naming every absent field, rather than filling in something plausible.
 *
 * A defaulted `maximum_slippage` is the worst artefact this module could
 * produce: it would be a number nobody chose, sitting in a field whose entire
 * purpose is to record that somebody chose it, and it would look identical to
 * one that had been considered. A registry row that refuses to exist is a
 * smaller problem than a registry row that lies quietly.
 *
 * WHAT IS DERIVED, AND FROM WHERE. Five fields come from the mint account by
 * way of the eligibility report, one is the time of the read, and two - `symbol`
 * and `name` - come from token metadata, which is a separate lookup and often
 * absent. Measured 2026-09-18 across three real mints:
 *
 *     WaveWarZ battle mint   neither source resolves - no metadata at all
 *     PYUSD                  Token-2022 tokenMetadata extension
 *     USDC                   Metaplex metadata PDA
 *
 * Three fixtures, two sources, and one asset resolving from neither. **Our own
 * battle mints have no metadata**, so a row for one carries null symbol and
 * name - which is why those fields are nullable and why `metadata_source`
 * records which lookup answered. A registry that guessed a symbol from a mint
 * address would be inventing an identity for an asset.
 */
import { b58decode, findPda } from "./pda";
import type { EligibilityReport, ParsedMintAccount } from "./tokenEligibility";

/** Metaplex Token Metadata. Where a classic SPL token's name and symbol live. */
export const METAPLEX_METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

/**
 * A Token-2022 mint's own metadata, if it carries the extension. Pure: the
 * account has already been read for the eligibility check, so this costs
 * nothing extra.
 */
export function tokenMetadataFromMintAccount(
  account: ParsedMintAccount | null,
): TokenMetadata | null {
  const ext = (account?.data?.parsed?.info?.extensions ?? []).find(
    (e) => e.extension === "tokenMetadata",
  ) as { state?: { name?: unknown; symbol?: unknown } } | undefined;
  const name = ext?.state?.name;
  const symbol = ext?.state?.symbol;
  if (typeof name !== "string" || typeof symbol !== "string") return null;
  if (!name.trim() || !symbol.trim()) return null;
  return { name: name.trim(), symbol: symbol.trim(), source: "token-2022-extension" };
}

/**
 * Where a classic token's Metaplex metadata lives. Returned rather than
 * fetched, because `lib/ww` does no network - the caller reads this address and
 * hands the bytes back to `parseMetaplexMetadata`.
 */
export function metaplexMetadataAddress(mint: string): string {
  return findPda(
    [new TextEncoder().encode("metadata"), b58decode(METAPLEX_METADATA_PROGRAM), b58decode(mint)],
    METAPLEX_METADATA_PROGRAM,
  ).address;
}

/**
 * Name and symbol out of a Metaplex metadata account.
 *
 * Layout: key(1), updateAuthority(32), mint(32), then borsh strings - a u32
 * length then that many bytes. The strings are FIXED-LENGTH and null-padded on
 * chain, so the trailing zeros are trimmed; leaving them in puts "USD Coin\0\0"
 * in a registry row and in every UI that renders it.
 *
 * Returns null on anything malformed rather than throwing. A caller following a
 * derived address can land on an account that is not metadata at all, and that
 * is a normal outcome here, not an exceptional one.
 */
export function parseMetaplexMetadata(raw: Uint8Array): TokenMetadata | null {
  try {
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    let o = 1 + 32 + 32;
    const readString = (): string => {
      if (o + 4 > raw.length) throw new Error("truncated");
      const n = view.getUint32(o, true);
      o += 4;
      if (n > 1000 || o + n > raw.length) throw new Error("implausible length");
      const bytes = raw.subarray(o, o + n);
      o += n;
      return new TextDecoder().decode(bytes).replace(/\0+$/, "").trim();
    };
    const name = readString();
    const symbol = readString();
    if (!name || !symbol) return null;
    return { name, symbol, source: "metaplex" };
  } catch {
    return null;
  }
}

/** Where `symbol` and `name` came from, including when nothing did. */
export type MetadataSource = "token-2022-extension" | "metaplex" | "none";

export interface TokenMetadata {
  symbol: string;
  name: string;
  source: Exclude<MetadataSource, "none">;
}

/**
 * The vocabulary is schema; the choice is the operator's.
 *
 * Defining which words are allowed is a decision about the shape of the
 * registry. Deciding which one applies to an asset is the policy this module
 * refuses to make.
 */
export type AssetStatus = "approved" | "pending" | "rejected" | "suspended";
export type RoutingStatus = "verified" | "unverified" | "failing";

/** The eight a person or a market feed supplies. None has a default. */
export interface AssetPolicy {
  operator_id: string;
  entry_enabled: boolean;
  exit_enabled: boolean;
  /** Lamports, or the asset's base units for a non-SOL pair. */
  minimum_liquidity: number;
  /** Basis points. */
  maximum_price_impact: number;
  /** Basis points. */
  maximum_slippage: number;
  routing_status: RoutingStatus;
  status: AssetStatus;
}

export interface AssetRegistryRow extends AssetPolicy {
  mint_address: string;
  symbol: string | null;
  name: string | null;
  /** Which lookup answered, so a null symbol is distinguishable from an unasked one. */
  metadata_source: MetadataSource;
  token_program: string | null;
  decimals: number | null;
  transfer_fee_status: "none" | "present" | "unknown";
  freeze_authority_status: "none" | "present" | "unknown";
  last_verified_at: string;
  /**
   * Beyond the PRD's sixteen fields, and here on purpose: a row that says
   * "approved" without recording WHAT was reviewed cannot be re-checked later.
   * When a mint changes, or the checker learns about a new extension, this is
   * what tells a reader whether the approval was made knowing about it.
   */
  eligibility: {
    overall: EligibilityReport["overall"];
    answered: number;
    unanswered: number;
    hazards: Array<{ id: string; detail: string }>;
  };
}

const POLICY_FIELDS: Array<keyof AssetPolicy> = [
  "operator_id",
  "entry_enabled",
  "exit_enabled",
  "minimum_liquidity",
  "maximum_price_impact",
  "maximum_slippage",
  "routing_status",
  "status",
];

/**
 * Which required fields are absent. Exported so a caller can ask before
 * building, rather than learning by exception.
 *
 * `false` and `0` are present. Only `undefined` and `null` are missing - a
 * check that treated falsy as absent would reject `entry_enabled: false`, which
 * is a decision somebody made and the most likely one for a new asset.
 */
export function missingPolicyFields(policy: Partial<AssetPolicy> | null | undefined): string[] {
  if (!policy) return POLICY_FIELDS.map(String);
  return POLICY_FIELDS.filter((f) => policy[f] === undefined || policy[f] === null).map(String);
}

export class IncompletePolicyError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `cannot build a registry row: ${missing.length} policy field(s) missing - ${missing.join(", ")}. ` +
        "These are decisions, not defaults; supply them or do not create the row.",
    );
    this.name = "IncompletePolicyError";
  }
}

const feeStatus = (r: EligibilityReport): AssetRegistryRow["transfer_fee_status"] => {
  const c = r.checks.find((x) => x.id === "transfer_fees");
  if (!c || c.verdict === "unknown") return "unknown";
  return c.verdict === "pass" ? "none" : "present";
};

const freezeStatus = (r: EligibilityReport): AssetRegistryRow["freeze_authority_status"] => {
  const c = r.checks.find((x) => x.id === "freeze_authority");
  if (!c || c.verdict === "unknown") return "unknown";
  return c.verdict === "pass" ? "none" : "present";
};

/**
 * Build one row, or refuse.
 *
 * `account` is taken as well as the report because the report is a judgement
 * about the account and this records both - the row keeps what was decided, and
 * enough of what it was decided from to be re-checked.
 */
export function buildAssetRegistryRow(p: {
  mint: string;
  account: ParsedMintAccount | null;
  eligibility: EligibilityReport;
  /** From either source, or null when neither resolved. */
  metadata?: TokenMetadata | null;
  policy: Partial<AssetPolicy>;
  /** Injectable so a test can pin the timestamp. */
  now?: () => Date;
}): AssetRegistryRow {
  const missing = missingPolicyFields(p.policy);
  if (missing.length) throw new IncompletePolicyError(missing);
  const policy = p.policy as AssetPolicy;

  if (p.eligibility.mint !== p.mint) {
    throw new Error(
      `eligibility report is for ${p.eligibility.mint}, not ${p.mint} - a row built from ` +
        "another asset's review would record an approval nobody gave",
    );
  }

  return {
    ...policy,
    mint_address: p.mint,
    symbol: p.metadata?.symbol ?? null,
    name: p.metadata?.name ?? null,
    metadata_source: p.metadata?.source ?? "none",
    token_program: p.eligibility.tokenProgram,
    decimals: p.eligibility.decimals,
    transfer_fee_status: feeStatus(p.eligibility),
    freeze_authority_status: freezeStatus(p.eligibility),
    last_verified_at: (p.now ? p.now() : new Date()).toISOString(),
    eligibility: {
      overall: p.eligibility.overall,
      answered: p.eligibility.answered,
      unanswered: p.eligibility.unanswered,
      hazards: p.eligibility.checks
        .filter((c) => c.verdict === "fail" || c.verdict === "review")
        .map((c) => ({ id: c.id, detail: c.detail })),
    },
  };
}

/**
 * Is this row's review old enough to redo?
 *
 * A registry is a set of statements about assets that can change underneath it:
 * a mint authority can mint, a freeze authority can freeze, and a routing venue
 * can stop routing. `last_verified_at` exists so a row can be told it is stale,
 * and this is the question that uses it. The threshold is the caller's, because
 * how long an approval stays good is - again - policy.
 */
export function isStale(row: AssetRegistryRow, maxAgeMs: number, now = Date.now()): boolean {
  const verified = Date.parse(row.last_verified_at);
  if (Number.isNaN(verified)) return true; // an unreadable date is not a fresh one
  return now - verified > maxAgeMs;
}
