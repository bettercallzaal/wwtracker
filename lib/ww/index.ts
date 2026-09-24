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
  DISCRIMINATOR_BY_NAME,
  RENT_SYSVAR,
  claimSharesInstruction,
  endBattleInstruction,
  initializeBattleInstruction,
  initializeMintsInstruction,
  launchBattleInstructions,
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
  SUPPLY_QUANTUM,
  ARTIST_FEE_BPS,
  PLATFORM_FEE_BPS,
  floorToQuantum,
  minimumSpendLamports,
  TRADE_FEE,
  feeSplit,
  lamportsToSol,
  quoteBuy,
  quoteSell,
  quoteClaim,
  SETTLEMENT_WINNING_TRADERS,
  SETTLEMENT_LOSING_TRADERS,
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
export {
  DustTradeError,
  battleStateFromRaw,
  planBuy,
  planSell,
  poolMoveBps,
  type BattleState,
  type BuyPlan,
  type PlanBuyParams,
  type PlanSellParams,
  type SellPlan,
} from "./tradePlan";

/**
 * Watching a battle and checking the curve against what actually happened.
 *
 * Separate from `tradePlan` because it answers the opposite question: not
 * "what should this trade do" but "did our model predict what this trade
 * did". A consumer verifying our arithmetic against their own node needs it.
 */
export {
  observe,
  spendForPoolDelta,
  type BattleSide,
  type TradeObservation,
  type TradeObservationKind,
} from "./tradeObservation";

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
 * PRD 33 and 34. What an indexer must cover, and - the part that matters -
 * which of it an indexer is entitled to be believed about.
 *
 * Section 33 says the indexer is "never the authority for canonical
 * settlement". Section 34 lists seventeen things to index. Together they mean
 * THIRTEEN of the seventeen are chain facts an indexer restates and cannot
 * overrule, three are the indexer's own and one is the operator's, and nothing
 * had written down which.
 *
 * The count is computed from `INDEXER_REQUIREMENTS` by the test, not typed.
 * This sentence said eleven until that assertion disagreed with it, and the
 * module's own doc comment said eleven too - the same wrong number in two
 * places, both written from memory.
 */
export {
  INDEXER_REQUIREMENTS,
  assessIndexerCoverage,
  formatCoverage,
  type Authority,
  type CoverageReport,
  type CoverageRow,
  type CoverageState,
  type Observation,
  type Requirement,
} from "./indexerCoverage";

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

/**
 * PRD 35, 36 and 37. The portable fighter card, the track record, and the six
 * ranking dimensions that are deliberately never summed.
 *
 * `buildArtistRecord` REFUSES settlement winners. The program settles on the
 * larger pool, so a record built from it is a record of who had more money
 * behind them - and on this platform one artist is 35.8% of all buy volume with
 * 93% of his own-battle buying on his own side. Section 38 says capital should
 * not be able to buy skill ranking; using the wrong winner field is exactly how
 * it would.
 */
export {
  RANKING_DIMENSIONS,
  SettlementWinnerRefused,
  buildArtistRecord,
  buildTrackRecord,
  type ArtistRecord,
  type RankingDimensions,
  type RecordBattle,
  type TrackRecord,
} from "./artistRecord";

/**
 * PRD 23, 24 and 25. The operator record, and an honest account of which of its
 * seventeen fields is measured, which is a registry decision, and which is a
 * rate nobody charges.
 *
 * `operator_revenue` and `network_pool_contribution` are the third kind and
 * this library has not had one before. PRD 18 proposes 0.15% to the originating
 * operator and PRD 24 proposes 0.10% to a network pool; the program pays
 * neither, and there is no pool account. Both come back with `_modelled` in the
 * field NAME rather than only in a note, so a caller destructuring the record
 * cannot get a number called `operator_revenue` by accident.
 */
export {
  IncompleteOperatorIdentity,
  POOL_ELIGIBILITY_MIN_BATTLES,
  PROPOSED_NETWORK_POOL_SHARE,
  PROPOSED_OPERATOR_SHARE,
  buildOperatorRecord,
  missingIdentityFields,
  modelOperatorEconomics,
  type OperatorActivity,
  type OperatorIdentity,
  type OperatorRecord,
} from "./operatorRecord";

// The battle account as the widget's route serves it: one decoder, the same
// offsets as decodeBattle, with the minted supplies a sell quote needs.
export { decodeBattleAccountResponse, type BattleAccountResponse } from "./battleAccountResponse";

// The sell side of the widget as functions: sizing against a balance, pricing
// off the minted supply, and reading a token balance reply honestly.
export { parseTokenAccountBalance, sellEstimate, shareOfSide, type SellEstimate } from "./widgetSell";

// The pool series a battle page draws: what the watcher keeps and how it is
// spelled. Pure; the disk half is lib/poolHistoryStore.ts, outside the surface.
export {
  HEARTBEAT_SECONDS,
  chartSeries,
  parseJsonl,
  recordingState,
  serializeSample,
  newestBattleId,
  shouldRecord,
  type ChartPoint,
  type PoolSample,
  type RecordingState,
} from "./poolHistory";

// Pool history from the chain, for a battle the watcher did not watch: one
// trade step per transaction, read off the program's own lines, replayed
// from zero and checked against the account. The RPC walk is a script.
export {
  endStateDiff,
  replayTrades,
  tradeFromTransaction,
  type BattleIds,
  type TradeStep,
  type TxLike,
} from "./poolBackfill";

// The 45-second window, measured: marks typed in the room, the watcher's
// samples and the account's clock, laid side by side per battle.
export {
  battleWindow,
  describeWindow,
  parseMarkLine,
  parseMarks,
  type BattleWindow,
  type Mark,
} from "./windowReport";

// The half of the announcement-lag question that needs nobody to type: how
// long after a battle opens on chain the first trade lands. An upper bound on
// the fastest participant's knowledge, never the lag itself.
export {
  buildOpeningGaps,
  countWithin,
  describeOpeningGaps,
  percentile,
  type FirstTrade,
  type Opening,
  type OpeningGap,
  type OpeningGapMiss,
  type OpeningGapReport,
} from "./openingGap";

// WHO gets there first. A tight arrival floor is either a room reacting
// together or one wallet on a timer, and the timing alone cannot tell them
// apart. This counts the first buyers instead.
export {
  describeFirstBuyers,
  firstBuyerConcentration,
  shortAddress,
  type FirstBuyerConcentration,
  type FirstBuyerRow,
  type TraderTally,
} from "./firstBuyer";

// Accepting a mark from the page the operator is already watching, rather than
// from a second terminal that five sessions running never got opened.
export {
  acceptMarkLabel,
  markLine,
  marksFileName,
  MAX_LABEL_LENGTH,
  type MarkAccepted,
  type MarkRejected,
} from "./markInput";
export { marksEnabled } from "./marksFlag";
export { launchEnabled } from "./launchFlag";

// Launching a battle of our own. The program is permissionless for it,
// established by simulation 2026-09-24 from a wallet that is not the treasury.
export {
  BATTLE_ACCOUNT_BYTES as LAUNCH_BATTLE_ACCOUNT_BYTES,
  canAfford,
  checkLaunch,
  launchCost,
  LAUNCH_ACCOUNTS,
  MINT_ACCOUNT_BYTES,
  VAULT_ACCOUNT_BYTES,
  type LaunchCheck,
  type LaunchCost,
  type LaunchParams,
} from "./launchPlan";

// Whether going first pays: the opening side against the larger final pool.
// Carries its own limit, because the first buy moves the outcome it is scored
// against.
export {
  coinTailProbability,
  describeFirstSide,
  firstSideReport,
  marginShare,
  outcomeOf,
  type FirstSideOutcome,
  type FirstSideReport,
  type FirstSideRow,
} from "./firstSide";

// The envelope a wallet is handed for signing: the unsigned transaction.
export { unsignedTransaction } from "./wallet";

// Read again until the answer changes: for a balance that an RPC has not
// caught up with yet, right after a trade.
export { pollForChange, type PollResult } from "./pollForChange";

// Did it land? sendTransaction's signature means a node accepted the
// broadcast; the cluster's word is landed, failed, or not known yet, and
// unknown is never reported as failure.
export {
  confirmSignature,
  describeConfirmation,
  isLanded,
  type ConfirmOutcome,
  type ConfirmResult,
  type SignatureStatus,
} from "./confirm";

// Settling: what endBattle will do, in the program's own numbers, before a
// wallet signs it. Winner by pool, the three legs of the losing pool.
export { describeAge, secondsSinceEnd, settlePreview, type SettlePreview } from "./settle";

// What a night produced, out of the samples the watcher stored: observed pool
// moves, the largest one, the final minute, and how much of the battle the
// samples actually cover.
export {
  buildNightRecord,
  describeNightRecord,
  type NightRecord,
  type PoolMove,
} from "./nightRecord";

// Settling many at once: several endBattle instructions fit in one
// transaction, so a long list of unsettled battles costs a few approvals
// rather than one each. The packer measures the real message.
export {
  describeBatches,
  packSettleBatches,
  unitLimitFor,
  MAX_UNITS,
  SIGNATURE_BYTES,
  TRANSACTION_PACKET_BYTES,
  UNITS_OVERHEAD,
  UNITS_PER_SETTLE,
  type SettleBatch,
} from "./settleBatch";
