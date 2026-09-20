/**
 * The WaveWarZ client SDK: the declared public surface of `lib/ww`.
 *
 * PRD section 41. The row read "BUILDABLE, and nothing is missing any more",
 * which was true about the IDL and wrong about the shape of this directory.
 * Measured 2026-09-18: 1,739 lines, ten modules, 84 exported symbols, and
 * **zero external dependencies** - so the SDK was not unbuilt, it was built and
 * undeclared. Nothing said which of those 84 exports a consumer may rely on,
 * nothing proved the thing imports outside this app, and "is this public?" was
 * answered by grep.
 *
 * WHY A BOUNDARY IS THE DELIVERABLE AND NOT A RENAME. Stage 3 of Zaal's
 * 2026-09-13 ruling has Candy implementing this on her own stack. Everything
 * reachable from here is a promise to her; everything not exported here is ours
 * to change. Without the line drawn, every internal helper is load-bearing by
 * accident and the first refactor is a breaking change nobody announced.
 *
 * WHAT IS DELIBERATELY NOT HERE, and this is the half that took measuring:
 *
 *   - `relayPolicy` and `rateLimit` are the SERVER's. They exist because our
 *     RPC key must not reach a browser, and they encode what OUR relay will
 *     forward. A consumer running their own stack needs their own answer to
 *     that, not ours.
 *   - `widgetFlag` reads `process.env`. It is the gate on our deployment, not a
 *     library function, and exporting it would put `process` in a browser
 *     bundle.
 *
 * Both are importable directly by path for anyone who wants them. They are out
 * of the DECLARED surface because a package's public API is a statement about
 * what will keep working, and those two are ours to change without warning.
 *
 * THE PORTABILITY CLAIM IS NOW UNIFORM, and it was not an hour ago.
 * `relayPolicy.ts` used `Buffer`, which is Node's and which Next silently
 * polyfills in the browser - so it worked everywhere while being the one module
 * here that could not run outside a bundler that patches globals. Declaring
 * this surface is what had a reason to look. See `wwSdkBoundary.test.ts`, which
 * now fails on any Node builtin, any dependency, and any `Buffer`.
 */

// The address primitives. Everything else derives from these.
export {
  PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  b58decode,
  b58encode,
  battlePda,
  findPda,
  mintPda,
  vaultPda,
} from "./pda";

// The instructions, and the account creation a first trade needs.
export {
  battleAccountsFromRaw,
  buySharesInstruction,
  claimSharesInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  deadlineIn,
  sellSharesInstruction,
  traderTokenAccountInstructions,
  type AccountMeta,
  type BattleAccounts,
  type BuyParams,
  type Instruction,
  type SellParams,
  type TradeParams,
} from "./instructions";

// Turning instructions into the bytes a wallet signs.
export {
  COMPUTE_BUDGET_PROGRAM_ID,
  compileAccounts,
  computeUnitLimitInstruction,
  computeUnitPriceInstruction,
  parseMessage,
  reserializeMessage,
  serializeMessage,
  type CompiledAccount,
  type Message,
} from "./message";

// Prices, measured against 1,803 real trades rather than derived from a paper.
export {
  ARTIST_FEE_SHARE,
  BUY_POOL_SHARE,
  CURVE_K,
  TRADE_FEE,
  feeSplit,
  lamportsToSol,
  quoteBuy,
  quoteSell,
  solToLamports,
  withSlippage,
} from "./quote";

// What a wallet can claim, and the two facts that have to hold together.
export {
  VAULT_RENT_FLOOR_LAMPORTS,
  battleIdFromAccount,
  battleIsSettled,
  battlesToClaim,
  claimablePositions,
  nonZeroHoldings,
  vaultPayableLamports,
  verifyMintBelongsToBattle,
  type BattleMint,
  type ClaimablePosition,
  type HeldToken,
} from "./claim";

/**
 * Building a trade from state read NOW. The reason this is public rather than a
 * detail of our widget: the slippage floor has to come from a fresh pool read,
 * and a consumer writing their own version would reproduce the exact defect
 * this module was extracted to fix.
 */
export { planBuy, poolMoveBps, type BattleState, type BuyPlan, type PlanBuyParams } from "./tradePlan";

/**
 * PRD section 31, the universal battle record. Public because the record
 * existed and was not obtainable by anyone else: the Python emitter reads a
 * census file only this estate has, and an operator with an RPC endpoint and a
 * battle id had no way to produce one.
 */
export {
  MIN_BATTLE_ACCOUNT_BYTES,
  buildBattleRecord,
  unsetFields,
  type BattleRecord,
  type OffChainInputs,
  type RecordTrade,
} from "./battleRecord";

/**
 * Finding a battle in the first place.
 *
 * Everything else in this library takes a battle id you already have. This is
 * where one comes from, and without it an integrator has to reinvent a
 * `getProgramAccounts` call from a procedure written for a human - including
 * the id-range guard, which is the part people miss.
 *
 * No network here either: it builds the request and parses the response.
 */
export {
  BATTLE_ACCOUNT_BYTES,
  DISCOVERY_SLICE_BYTES,
  awaitingSettlement,
  battleDiscoveryRequest,
  liveBattles,
  parseBattleAccount,
  parseBattleAccounts,
  phaseCounts,
  settledWithValue,
  type BattlePhase,
  type BattleSummary,
  type ProgramAccountRow,
} from "./discovery";

/**
 * PRD 32. The other half of the record: given one somebody handed you, which
 * of its fields does the chain actually agree with.
 *
 * Exported beside `buildBattleRecord` on purpose. A consumer who can only build
 * records trusts whoever sent them one; the pair is what makes the record a
 * claim that can be refused. It cannot return "verified" - eighteen of the
 * record's fields have no chain representation at all, and a verdict implying
 * otherwise would be the most dangerous thing this SDK could export.
 */
export {
  MIN_VERIFIABLE_ACCOUNT_BYTES,
  contradictions,
  verifyBattleRecord,
  type ClaimedBattleRecord,
  type FieldCheck,
  type FieldVerdict,
  type VerificationReport,
  type VerificationVerdict,
} from "./battleVerification";

/**
 * PRD section 56, price impact. Public because a consumer building their own
 * trade panel needs the same figure and the same three-state assessment - and
 * because the alternative is each of them folding the fee into it.
 */
export {
  PriceImpactExceededError,
  assessPriceImpact,
  describePriceImpact,
  priceImpactBps,
  spotPricePerToken,
  type PriceImpactAssessment,
} from "./priceImpact";

/**
 * PRD section 16, the Approved Asset Registry. Public alongside the eligibility
 * checker because they are two halves of one decision: the checker reports what
 * chain says, and this records what a person decided about it. An operator
 * needs both, and needs them to agree about field names.
 */
export {
  IncompletePolicyError,
  METAPLEX_METADATA_PROGRAM,
  buildAssetRegistryRow,
  isStale,
  metaplexMetadataAddress,
  missingPolicyFields,
  parseMetaplexMetadata,
  tokenMetadataFromMintAccount,
  type AssetPolicy,
  type AssetRegistryRow,
  type AssetStatus,
  type MetadataSource,
  type RoutingStatus,
  type TokenMetadata,
} from "./assetRegistry";

/**
 * PRD section 17, token eligibility. Public because an operator deciding
 * whether to accept an asset is exactly the consumer this SDK is for, and
 * because the alternative is each of them re-deriving which Token-2022
 * extensions change what a transfer means.
 */
export {
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  checkTokenEligibility,
  summariseEligibility,
  type EligibilityCheck,
  type EligibilityReport,
  type ParsedMintAccount,
  type Verdict,
} from "./tokenEligibility";

// What the program says when it refuses, and which of those we have seen.
export {
  PROGRAM_ERRORS,
  decodeSimulationError,
  explainSimulationError,
  programError,
  type ProgramError,
} from "./errors";

/**
 * The hash, exported because a consumer re-implementing PDA derivation needs
 * the same one and because hand-rolling it twice is how two stacks disagree
 * about an address.
 */
export { sha256 } from "./sha256";

/**
 * Phantom. Browser-only in what it DOES - it looks for an injected provider -
 * but safe to import anywhere: every `window` access is inside a function, so a
 * Node consumer can import the module and simply never call it.
 *
 * `signMessage` is still UNVERIFIED against a live wallet, which its own header
 * says. It is exported anyway rather than held back, because the alternative is
 * a consumer writing a fourth copy of the same unverified call.
 */
export {
  assembleSignedTransaction,
  connect,
  detectPhantom,
  mapWalletError,
  readSignature,
  signMessage,
  watchWallet,
  WalletError,
  type PhantomProvider,
} from "./wallet";
