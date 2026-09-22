/**
 * What the program says when it refuses, and which of those we have actually
 * seen.
 *
 * WHY A CONSUMER NEEDS THIS AND CANNOT DERIVE IT. A failing simulation returns
 * `{"InstructionError":[2,{"Custom":6001}]}`. The number is meaningful only
 * against the program's error list, and a widget that renders "custom program
 * error: 0x1771" has told the person nothing. Stage 3 of Zaal's 2026-09-13
 * ruling has Candy implementing this on her own stack, so the mapping has to be
 * portable data rather than a switch statement inside our UI.
 *
 * THE COLUMN THAT MATTERS IS `observed`. Twenty-eight errors are DECLARED in
 * `chain/wavewarz.idl.json`. Four outcomes have actually been produced by this
 * lane against the deployed program, and they are marked. Everything else is a
 * name we are repeating from a file, which is a weaker claim and is labelled as
 * one - the same distinction the rest of this repo draws between a measurement
 * and a citation.
 *
 * ANCHOR'S OWN ERRORS ARE NOT IN THE IDL and are the ones a client hits first.
 * 3012 cost this lane an afternoon: a first-time trader's token accounts do not
 * exist, the program says "The program expected this account to be already
 * initialized", and nothing in the IDL mentions it because it is thrown by the
 * framework before the instruction body runs. A map built only from the IDL
 * would have been silent on the single most likely failure a new user meets.
 */

export interface ProgramError {
  code: number;
  name: string;
  /** The program's own wording. Shown to people, so it is not paraphrased. */
  message: string;
  /** Where the code is declared. Anchor's framework errors are not in the IDL. */
  source: "idl" | "anchor";
  /**
   * Has this lane actually produced it against the deployed program? A note
   * says how. Absent means the code is repeated from a declaration and has
   * never been seen here.
   */
  observed?: string;
  /**
   * What a trader should make of it, appended after the program's own words.
   * Only where the program's wording reads as a failure when it is a guard
   * doing its job: on 2026-09-20 traders in the finals Space read
   * "Slippage tolerance exceeded" as the site being broken, and the memo to
   * the platform about it says the fix is the sentence, not the guard.
   */
  advice?: string;
}

/**
 * Anchor framework errors, which the IDL does not carry. Only the ones a
 * trading client can realistically hit are listed; inventing the rest from
 * memory would put unverified rows next to measured ones.
 */
const ANCHOR_ERRORS: ProgramError[] = [
  {
    code: 3012,
    name: "AccountNotInitialized",
    message: "The program expected this account to be already initialized.",
    source: "anchor",
    observed:
      "2026-09-17, a first trade from a wallet with no token accounts for that battle. 9,732 compute units, failing on artist_a_token before the battle logic ran. Fixed by prepending createAssociatedTokenAccountIdempotent - see instructions.ts.",
  },
];

/** The 28 errors declared in chain/wavewarz.idl.json, in code order. */
const IDL_ERRORS: ProgramError[] = [
  { code: 6000, name: "InvalidDuration", message: "Invalid duration", source: "idl" },
  {
    code: 6001,
    name: "BattleEnded",
    message: "Battle has already ended",
    source: "idl",
    observed:
      "2026-09-17, buying on a settled battle. 26,591 units on a returning trader and 29,769 with token accounts created in the same transaction - the cost is the program reaching its end-time check, not failing early.",
  },
  { code: 6002, name: "BattleActive", message: "Battle is still active", source: "idl" },
  { code: 6003, name: "BattleNotActive", message: "Battle is not active", source: "idl" },
  { code: 6004, name: "InvalidStartTime", message: "Invalid start time", source: "idl" },
  { code: 6005, name: "InsufficientFunds", message: "Insufficient SOL balance", source: "idl" },
  { code: 6006, name: "InvalidAmount", message: "Invalid token amount", source: "idl" },
  { code: 6007, name: "MathOverflow", message: "Calculation overflow", source: "idl" },
  { code: 6008, name: "InvalidCalculation", message: "Invalid calculation", source: "idl" },
  {
    code: 6009,
    name: "BattleNotEnded",
    message: "Battle not ended",
    source: "idl",
    observed:
      "2026-09-18, claiming on battle 1787568630, which wavewarz.info reports as winnerDecided true. 11,909 units. The public API's winnerDecided and the program's settled byte are different facts - see claim.ts.",
  },
  { code: 6010, name: "WinnerAlreadyDecided", message: "Winner already decided", source: "idl" },
  { code: 6011, name: "BattleAlreadyInitialized", message: "Battle already initialized", source: "idl" },
  { code: 6012, name: "MintsAlreadyInitialized", message: "Mints already initialized", source: "idl" },
  {
    code: 6013,
    name: "DeadlineExceeded",
    message: "Transaction deadline exceeded",
    source: "idl",
    advice: "The trade carried a time limit and the chain saw it after that time. Nothing was traded. Build it again and approve it sooner.",
  },
  {
    code: 6014,
    name: "SlippageExceeded",
    message: "Slippage tolerance exceeded",
    source: "idl",
    advice: "The floor did its job: the price moved past it between the quote and the chain, so nothing was traded at the worse price. Re-quote and try again, or widen the floor.",
  },
  { code: 6015, name: "InvalidTokenMint", message: "Invalid token mint", source: "idl" },
  { code: 6016, name: "TieNotAllowed", message: "Tie is not allowed", source: "idl" },
  { code: 6017, name: "NoTokensToClaim", message: "No tokens to claim", source: "idl" },
  { code: 6018, name: "InsufficientFundsForTransaction", message: "Insufficient funds for transaction", source: "idl" },
  { code: 6019, name: "NonZeroBalance", message: "Account has non-zero balance", source: "idl" },
  { code: 6020, name: "MathOperationOverflow", message: "Math operation overflow", source: "idl" },
  { code: 6021, name: "InvalidVaultOwner", message: "Invalid vault owner", source: "idl" },
  { code: 6022, name: "InvalidTokenAccountOwner", message: "Invalid token account owner", source: "idl" },
  { code: 6023, name: "InvalidBattleVault", message: "Invalid battle vault", source: "idl" },
  { code: 6024, name: "InsufficientVaultBalance", message: "Insufficient vault balance", source: "idl" },
  { code: 6025, name: "WinnerNotDecided", message: "Winner not decided", source: "idl" },
  { code: 6026, name: "TransactionInProgress", message: "Transaction already in progress", source: "idl" },
  { code: 6027, name: "InvalidTransactionState", message: "Invalid transaction state", source: "idl" },
];

export const PROGRAM_ERRORS: readonly ProgramError[] = [...ANCHOR_ERRORS, ...IDL_ERRORS];

const BY_CODE = new Map(PROGRAM_ERRORS.map((e) => [e.code, e]));

/** Look up one error. Returns undefined for a code nobody has declared. */
export function programError(code: number): ProgramError | undefined {
  return BY_CODE.get(code);
}

/**
 * Pull the custom error code out of whatever `simulateTransaction` returned.
 *
 * The shape is `{"InstructionError":[<index>,{"Custom":<code>}]}`, and the
 * instruction index matters as much as the code: a transaction that creates two
 * token accounts before a buy fails at index 4, not index 0, and a reader
 * shown only the code cannot tell which instruction refused.
 *
 * Returns null rather than throwing on anything unrecognised. An RPC can return
 * a string error, a shape from a newer runtime, or nothing at all, and none of
 * those are exceptional enough to crash a widget over.
 */
export function decodeSimulationError(
  err: unknown,
): { instructionIndex: number; code: number } | null {
  if (!err || typeof err !== "object") return null;
  const ix = (err as { InstructionError?: unknown }).InstructionError;
  if (!Array.isArray(ix) || ix.length < 2) return null;
  const [index, detail] = ix;
  if (typeof index !== "number") return null;
  if (!detail || typeof detail !== "object") return null;
  const code = (detail as { Custom?: unknown }).Custom;
  if (typeof code !== "number") return null;
  return { instructionIndex: index, code };
}

/**
 * The sentence to show a person for a failed simulation.
 *
 * Falls back to naming the raw code rather than saying something vague. "The
 * program refused with code 6031" is worse than a sentence and far better than
 * "something went wrong", because it is the one string that lets somebody else
 * work out what happened.
 */
export function explainSimulationError(err: unknown): string {
  const decoded = decodeSimulationError(err);
  if (!decoded) return "The program refused the transaction, and returned no code this client recognises.";
  const known = programError(decoded.code);
  if (!known) return `The program refused with error code ${decoded.code}, which is not in this client's list.`;
  return known.advice ? `${known.message}. ${known.advice}` : known.message;
}
