/**
 * PRD section 17, Token Eligibility: what a mint account can tell you before
 * anyone is allowed to trade with it.
 *
 * THIS FUNCTION REPORTS. IT DOES NOT DECIDE. Section 17 asks for each hazard to
 * be "reviewed", and section 16's Approved Asset Registry carries the `status`
 * field that records what somebody decided. Those are different jobs, and
 * collapsing them here would bury a policy choice - is a freeze authority
 * disqualifying for a payout asset? - inside a function that looks like it is
 * reading chain. So a hazard is reported as `review` with the reason attached,
 * and only things that are wrong regardless of anybody's policy are `fail`.
 *
 * IT CAN NEVER RETURN "ELIGIBLE", and that is deliberate rather than a
 * limitation to fix later. Five of section 17's twelve checks need market data
 * or a human: liquidity for the intended battle size, a reliable route to and
 * from SOL, price impact within thresholds, token-account requirements, and
 * whether the manipulation risk is acceptable. None of those is on a mint
 * account. A function that returned a green boolean while five checks were
 * unanswered would be a worse artefact than no function, because the caller
 * would stop looking.
 *
 * THE ASYMMETRY IS THE POINT. A token can be shown INELIGIBLE from partial
 * data - one disqualifying fact is enough. It cannot be shown eligible from
 * partial data, ever. So the overall verdict is one of `ineligible`,
 * `needs-review` or `chain-clean`, and `chain-clean` says exactly what it
 * means: everything readable from chain looked fine and five questions remain.
 *
 * WHY IT EXISTS NOW. Scoring PRD 57 on 2026-09-18 found that Token-2022
 * appears nowhere in this repository. `/api/ww/claimable` filters holdings to
 * the classic token program, so a Token-2022 position is silently INVISIBLE
 * rather than refused - and the PRD asks for rejection, which is the opposite
 * of silence. This is the module that lets a caller refuse one and say why.
 */

/**
 * The SPL token programs. A mint is owned by exactly one of them.
 *
 * The classic one is RE-EXPORTED from `pda.ts` rather than written out again.
 * The first draft of this file declared its own copy of the same 44 characters,
 * which is how two constants for one thing start, and this repo has already
 * spent a PR removing exactly that shape between `pda.ts` and
 * `battlePositions.ts`. Verified identical before collapsing them.
 */
import { TOKEN_PROGRAM_ID } from "./pda";

export const TOKEN_PROGRAM = TOKEN_PROGRAM_ID;

/** Token-2022 has no equivalent elsewhere in this repo, so it is declared here. */
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export type Verdict =
  /** Nothing concerning found, for this check, from this data. */
  | "pass"
  /** A real hazard is present and named. Whether it disqualifies is policy. */
  | "review"
  /** Wrong regardless of policy - not a mint, missing, malformed. */
  | "fail"
  /** Not answerable from a mint account. Says what it would need. */
  | "unknown";

export interface EligibilityCheck {
  /** Stable id, so a registry row can reference a check without matching prose. */
  id: string;
  /** Section 17's own wording, so the mapping to the PRD stays legible. */
  requirement: string;
  verdict: Verdict;
  detail: string;
}

export interface EligibilityReport {
  mint: string;
  /** Which program owns the mint, or null when it could not be read. */
  tokenProgram: string | null;
  decimals: number | null;
  checks: EligibilityCheck[];
  /**
   * Never "eligible". See the header: five checks are not on chain, so this
   * function is not entitled to that word.
   */
  overall: "ineligible" | "needs-review" | "chain-clean";
  answered: number;
  unanswered: number;
}

/**
 * A mint account as an RPC returns it with `jsonParsed`. Narrowed to the fields
 * section 17 asks about, and every one optional: a caller can hand this an
 * account that is not a mint at all, and finding that out is one of the checks.
 */
export interface ParsedMintAccount {
  owner?: string;
  data?: {
    parsed?: {
      type?: string;
      info?: {
        decimals?: number;
        mintAuthority?: string | null;
        freezeAuthority?: string | null;
        isInitialized?: boolean;
        supply?: string;
        extensions?: Array<{ extension?: string; state?: unknown }>;
      };
    };
  };
}

/**
 * Token-2022 extensions that change what a transfer MEANS, with why each one
 * matters to a settlement asset. Named individually rather than treated as one
 * "has extensions" flag, because they are not equally serious and a caller
 * deciding policy needs to know which one it is looking at.
 */
const HAZARDOUS_EXTENSIONS: Record<string, string> = {
  permanentDelegate:
    "a permanent delegate can move any holder's tokens without their signature",
  transferHook:
    "a transfer hook runs third-party code on every transfer, which can fail or reorder settlement",
  transferFeeConfig:
    "a transfer fee means the amount received is not the amount sent, so payouts do not reconcile",
  confidentialTransferMint:
    "confidential transfers hide amounts, which makes volume and settlement unauditable",
  confidentialTransferFeeConfig:
    "confidential transfer fees hide the fee as well as the amount",
  mintCloseAuthority:
    "the mint can be closed, which strands anything still denominated in it",
  pausableConfig: "transfers can be paused by the issuer",
  defaultAccountState:
    "new token accounts can default to frozen, so a payout can land unusable",
};

const check = (id: string, requirement: string, verdict: Verdict, detail: string): EligibilityCheck => ({
  id,
  requirement,
  verdict,
  detail,
});

/**
 * The five that a mint account cannot answer. Emitted every time, with what
 * each would need, so the report's shape does not change depending on how much
 * was knowable - a caller counting `unknown` gets the same five whatever token
 * it asks about.
 */
function offChainChecks(): EligibilityCheck[] {
  return [
    check("liquidity", "Liquidity sufficient for intended battle sizes", "unknown",
      "needs pool depth from a venue, and the intended battle size, neither of which is on a mint account"),
    check("route", "Reliable route to and from SOL exists", "unknown",
      "needs a routing quote from an aggregator"),
    check("price_impact", "Price impact remains within configured thresholds", "unknown",
      "needs a quote at the intended size, plus the threshold from the asset registry (PRD 16)"),
    check("token_account_requirements", "Token-account requirements are known", "unknown",
      "depends on the chosen route and on whether the recipient already holds the asset"),
    check("manipulation_risk", "Manipulation and failure risks are acceptable", "unknown",
      "a judgement, recorded in the asset registry's status field (PRD 16), not a property of the mint"),
  ];
}

/**
 * Run section 17's checks against one mint account.
 *
 * `mint` is passed separately from the account because "the exact mint address
 * was verified" is itself a check, and a function that only saw the account
 * could not perform it - it would be confirming the address it was handed
 * against itself.
 */
export function checkTokenEligibility(
  mint: string,
  account: ParsedMintAccount | null,
): EligibilityReport {
  const checks: EligibilityCheck[] = [];

  if (!account) {
    checks.push(check("mint_exists", "Exact mint address verified", "fail",
      "no account at this address"));
    checks.push(...offChainChecks());
    return report(mint, null, null, checks);
  }

  const info = account.data?.parsed?.info;
  const isMint = account.data?.parsed?.type === "mint";
  const owner = account.owner ?? null;

  if (!isMint || !info) {
    checks.push(check("mint_exists", "Exact mint address verified", "fail",
      `account exists but is not a mint (parsed type: ${account.data?.parsed?.type ?? "unreadable"})`));
    checks.push(...offChainChecks());
    return report(mint, owner, null, checks);
  }
  checks.push(check("mint_exists", "Exact mint address verified", "pass",
    `mint account, initialized: ${info.isInitialized !== false}`));

  // Token program. Not a hazard by itself - Token-2022 is a real program and
  // plenty of sound tokens use it - but it decides which other checks apply,
  // and an unrecognised owner means nothing below can be trusted.
  if (owner === TOKEN_PROGRAM) {
    checks.push(check("token_program", "Token Program / Token-2022 behavior identified", "pass",
      "classic SPL Token. No extensions exist on this program, so transfer semantics are fixed"));
  } else if (owner === TOKEN_2022_PROGRAM) {
    checks.push(check("token_program", "Token Program / Token-2022 behavior identified", "review",
      "Token-2022. Transfer semantics depend on the extensions below and must be read, not assumed"));
  } else {
    checks.push(check("token_program", "Token Program / Token-2022 behavior identified", "fail",
      `owned by ${owner ?? "an unreadable program"}, which is neither SPL token program`));
  }

  // Decimals.
  const decimals = typeof info.decimals === "number" ? info.decimals : null;
  if (decimals === null) {
    checks.push(check("decimals", "Decimals validated", "fail", "no decimals field on the mint"));
  } else if (decimals > 18) {
    checks.push(check("decimals", "Decimals validated", "review",
      `${decimals} decimals, which overflows a u64 for ordinary amounts and breaks naive arithmetic`));
  } else {
    checks.push(check("decimals", "Decimals validated", "pass",
      `${decimals} decimals, within the range ordinary u64 arithmetic handles`));
  }

  // Freeze authority. Present means somebody can freeze a holder's account,
  // which for a payout asset means a payout that cannot be spent.
  checks.push(
    info.freezeAuthority
      ? check("freeze_authority", "Freeze authority reviewed", "review",
          `set to ${info.freezeAuthority}; that key can freeze any holder's account, including one holding a payout`)
      : check("freeze_authority", "Freeze authority reviewed", "pass", "none, so no holder can be frozen"),
  );

  // Mint authority. Present means supply can grow.
  checks.push(
    info.mintAuthority
      ? check("mint_authority", "Mint authority reviewed", "review",
          `set to ${info.mintAuthority}; supply can be increased after any valuation`)
      : check("mint_authority", "Mint authority reviewed", "pass", "none, supply is fixed"),
  );

  // Extensions. Two of section 17's checks - transfer fees, and hooks or
  // unusual extensions - are answered from this one list.
  const present = (info.extensions ?? [])
    .map((e) => e.extension)
    .filter((e): e is string => typeof e === "string");

  const fee = present.filter((e) => e.toLowerCase().includes("transferfee"));
  checks.push(
    fee.length
      ? check("transfer_fees", "Transfer fees reviewed", "review",
          `${fee.join(", ")}: ${HAZARDOUS_EXTENSIONS[fee[0]] ?? "the amount received is not the amount sent"}`)
      : check("transfer_fees", "Transfer fees reviewed", "pass",
          owner === TOKEN_PROGRAM
            ? "classic SPL Token cannot carry a transfer fee"
            : "no transfer-fee extension on this mint"),
  );

  const others = present.filter(
    (e) => !e.toLowerCase().includes("transferfee") && e in HAZARDOUS_EXTENSIONS,
  );
  const benign = present.filter(
    (e) => !e.toLowerCase().includes("transferfee") && !(e in HAZARDOUS_EXTENSIONS),
  );
  checks.push(
    others.length
      ? check("extensions", "Transfer hooks or unusual extensions reviewed", "review",
          others.map((e) => `${e} (${HAZARDOUS_EXTENSIONS[e]})`).join("; "))
      : check("extensions", "Transfer hooks or unusual extensions reviewed", "pass",
          present.length
            ? `only extensions with no transfer-semantic effect: ${benign.join(", ")}`
            : "no extensions"),
  );

  checks.push(...offChainChecks());
  return report(mint, owner, decimals, checks);
}

function report(
  mint: string,
  tokenProgram: string | null,
  decimals: number | null,
  checks: EligibilityCheck[],
): EligibilityReport {
  const answered = checks.filter((c) => c.verdict !== "unknown").length;
  const unanswered = checks.length - answered;
  const overall: EligibilityReport["overall"] = checks.some((c) => c.verdict === "fail")
    ? "ineligible"
    : checks.some((c) => c.verdict === "review")
      ? "needs-review"
      : "chain-clean";
  return { mint, tokenProgram, decimals, checks, overall, answered, unanswered };
}

/**
 * A one-line summary for a log or a UI.
 *
 * Always states the unanswered count, even when everything readable passed,
 * because "chain-clean" read alone is the sentence somebody would mistake for
 * approval.
 */
export function summariseEligibility(r: EligibilityReport): string {
  const reviews = r.checks.filter((c) => c.verdict === "review").length;
  const fails = r.checks.filter((c) => c.verdict === "fail").length;
  const head =
    r.overall === "ineligible"
      ? `ineligible: ${fails} check${fails === 1 ? "" : "s"} failed`
      : r.overall === "needs-review"
        ? `needs review: ${reviews} hazard${reviews === 1 ? "" : "s"} found`
        : "nothing concerning on chain";
  return `${head}; ${r.unanswered} of ${r.checks.length} checks need data that is not on a mint account`;
}
