// WaveWarZ fee model - calculates where every SOL goes.
//
// Reference: CandyToyBox/wavewarz-intelligence CLAUDE.md and public/llms.txt.
// These figures are the platform's authoritative fee schedule.

// Fee percentages as decimal fractions
const ARTIST_TRADE_FEE = 0.01; // 1.0% per trade
const PLATFORM_TRADE_FEE = 0.005; // 0.5% per trade
const TOTAL_TRADE_FEE = ARTIST_TRADE_FEE + PLATFORM_TRADE_FEE; // 1.5% total

// Settlement split - applied to the losing pool
const SETTLEMENT_LOSING_TRADERS = 0.5; // 50% back to losing traders
const SETTLEMENT_WINNING_TRADERS = 0.4; // 40% to winning traders
const SETTLEMENT_WINNING_ARTIST = 0.05; // 5% to winning artist
const SETTLEMENT_LOSING_ARTIST = 0.02; // 2% to losing artist
const SETTLEMENT_PLATFORM = 0.03; // 3% to platform

// Launch fees.
//
// MEASURED 2026-09-06: THESE ARE NOT BEING COLLECTED. Twenty battle-creation
// transactions were inspected on mainnet and the treasury received nothing in
// any of them. The wallet's balance moves the other way - the creator pays
// about 0.0039 SOL in rent for the four accounts a battle needs (the Battle
// PDA, the vault, and both mints), and the creator pays it whoever they are,
// 20 of 20, treasury or third party.
//
// So battle creation is a cost, not a revenue line. Roughly 5.9 SOL has been
// spent creating 1,501 battles.
//
// The schedule below is kept because it is the documented intent and the
// waterfall still models it. Any figure derived from it is a model of what
// would happen if these were charged, not a measurement of income. See
// docs/LAUNCH-FEES.md.
const QUICK_BATTLE_LAUNCH_FEE = 0.69; // SOL - scheduled, not observed
const COMMUNITY_BATTLE_LAUNCH_FEE = 4; // SOL - scheduled, not observed

/** Measured cost to the creator of initialising a battle, in SOL. */
export const OBSERVED_CREATION_COST_SOL = 0.0039;

// Skip-queue auction
const SKIP_QUEUE_BASE = 0.02; // First skip costs 0.02 SOL
const SKIP_QUEUE_INCREMENT = 0.01; // Each successive skip costs 0.01 more

// Guard against non-finite/negative input by clamping to 0.
const clamp = (n: number): number => (isFinite(n) && n >= 0 ? n : 0);

// Trade fee split: input volume SOL, returns artist/platform/total breakdown.
export function tradeFeeSplit(volumeSol: number): {
  artistSol: number;
  platformSol: number;
  totalFeeSol: number;
} {
  const vol = clamp(volumeSol);
  return {
    artistSol: vol * ARTIST_TRADE_FEE,
    platformSol: vol * PLATFORM_TRADE_FEE,
    totalFeeSol: vol * TOTAL_TRADE_FEE,
  };
}

// Settlement split: input the losing pool SOL, returns where it goes.
export function settlementSplit(losingPoolSol: number): {
  losingTraders: number;
  winningTraders: number;
  winningArtist: number;
  losingArtist: number;
  platform: number;
} {
  const pool = clamp(losingPoolSol);
  return {
    losingTraders: pool * SETTLEMENT_LOSING_TRADERS,
    winningTraders: pool * SETTLEMENT_WINNING_TRADERS,
    winningArtist: pool * SETTLEMENT_WINNING_ARTIST,
    losingArtist: pool * SETTLEMENT_LOSING_ARTIST,
    platform: pool * SETTLEMENT_PLATFORM,
  };
}

// Next skip-queue auction price given the current front position (in SOL).
// If currentFrontSol is 0 (empty queue), first skip costs 0.02 SOL.
// Otherwise, it costs currentFrontSol + 0.01 SOL.
export function skipAuctionCost(currentFrontSol: number): number {
  const current = clamp(currentFrontSol);
  if (current === 0) return SKIP_QUEUE_BASE;
  return current + SKIP_QUEUE_INCREMENT;
}

// Skip-queue ladder: the first n auction prices (0.02, 0.03, 0.04, ...).
export function skipLadder(n: number): number[] {
  const count = Math.max(0, Math.floor(n));
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(SKIP_QUEUE_BASE + i * SKIP_QUEUE_INCREMENT);
  }
  return result;
}

// Platform revenue breakdown from all sources.
export function platformRevenue(input: {
  volumeSol: number;
  losingPoolSol: number;
  quickBattles: number;
  communityBattles: number;
  skipFeesSol: number;
}): {
  tradeFeeSol: number;
  settlementFeeSol: number;
  quickBattleLaunchFeesSol: number;
  communityBattleLaunchFeesSol: number;
  skipQueueFeeSol: number;
  totalSol: number;
} {
  const volume = clamp(input.volumeSol);
  const losingPool = clamp(input.losingPoolSol);
  const quickBattles = Math.max(0, Math.floor(input.quickBattles));
  const communityBattles = Math.max(0, Math.floor(input.communityBattles));
  const skipFees = clamp(input.skipFeesSol);

  const tradeFee = volume * PLATFORM_TRADE_FEE;
  const settlementFee = losingPool * SETTLEMENT_PLATFORM;
  const quickLaunchFees = quickBattles * QUICK_BATTLE_LAUNCH_FEE;
  const communityLaunchFees = communityBattles * COMMUNITY_BATTLE_LAUNCH_FEE;

  return {
    tradeFeeSol: tradeFee,
    settlementFeeSol: settlementFee,
    quickBattleLaunchFeesSol: quickLaunchFees,
    communityBattleLaunchFeesSol: communityLaunchFees,
    skipQueueFeeSol: skipFees,
    totalSol: tradeFee + settlementFee + quickLaunchFees + communityLaunchFees + skipFees,
  };
}

// Export constants for UI display and testing.
export const FEE_SCHEDULE = {
  ARTIST_TRADE_FEE,
  PLATFORM_TRADE_FEE,
  TOTAL_TRADE_FEE,
  SETTLEMENT_LOSING_TRADERS,
  SETTLEMENT_WINNING_TRADERS,
  SETTLEMENT_WINNING_ARTIST,
  SETTLEMENT_LOSING_ARTIST,
  SETTLEMENT_PLATFORM,
  QUICK_BATTLE_LAUNCH_FEE,
  COMMUNITY_BATTLE_LAUNCH_FEE,
  SKIP_QUEUE_BASE,
  SKIP_QUEUE_INCREMENT,
} as const;
