/**
 * The instructions a trading widget needs: buy, sell, claim, and the token
 * account creation that has to come before a wallet's first trade in a battle.
 *
 * Each builder returns the standard instruction shape - a program id, an ordered
 * account list with its writable and signer flags, and the data bytes - and
 * nothing else. It does not connect, sign, send, or know what a wallet is. That
 * is deliberate: stage 3 of Zaal's 2026-09-13 ruling has Candy implementing this
 * on her own stack, so the deliverable has to be portable, and the part that is
 * genuinely shared between two stacks is exactly this - which bytes, in which
 * order, to which accounts. Feed the result to @solana/web3.js, to a wallet
 * adapter, or to anything that speaks the same shape.
 *
 * Correctness is defined against chain, not against this file's own reasoning:
 * `__fixtures__/ww-buy-transaction.json` is a real mainnet buy, and the test
 * asserts this module reproduces its 33 data bytes and all 13 accounts in order.
 *
 * WHAT THIS MODULE CANNOT KNOW, and why three accounts are parameters:
 * `wavewarzWallet`, `artistA` and `artistB` live in the battle account on chain
 * (offsets 100, 36, 68). Everything else - the battle PDA, both mints, both of
 * the trader's token accounts, the vault - derives from the battle id and the
 * trader's address alone. So a caller needs two inputs plus one account read,
 * and `BattleAccounts` is that read's result.
 */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  b58encode,
  battlePda,
  i64le,
  mintPda,
  u64le,
  vaultPda,
} from "./pda";

export interface AccountMeta {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface Instruction {
  programId: string;
  keys: AccountMeta[];
  data: Uint8Array;
}

/** The three wallets stored in the battle account. Read them once, pass them in. */
export interface BattleAccounts {
  /** Offset 100. The fee destination, and the operator field. */
  wavewarzWallet: string;
  /** Offset 36. */
  artistA: string;
  /** Offset 68. */
  artistB: string;
}

// From chain/wavewarz.idl.json. An Anchor discriminator is the first eight bytes
// of sha256("global:<name>"), but these are copied from the IDL rather than
// recomputed, because the IDL is what Hurricane confirmed matches the deployed
// program on 2026-09-08.
const DISCRIMINATOR = {
  buyShares: [40, 239, 138, 154, 8, 37, 106, 108],
  sellShares: [184, 164, 169, 16, 231, 158, 199, 196],
  claimShares: [130, 131, 29, 237, 134, 20, 110, 245],
  endBattle: [80, 145, 208, 48, 183, 92, 168, 112],
  initializeBattle: [117, 108, 166, 159, 146, 82, 246, 223],
  initializeMints: [189, 84, 85, 142, 177, 200, 57, 22],
} as const;

/** The rent sysvar, which `endBattle` takes read-only as its last account. */
export const RENT_SYSVAR = "SysvarRent111111111111111111111111111111111";

const w = (pubkey: string): AccountMeta => ({ pubkey, isSigner: false, isWritable: true });
const r = (pubkey: string): AccountMeta => ({ pubkey, isSigner: false, isWritable: false });
const signer = (pubkey: string): AccountMeta => ({ pubkey, isSigner: true, isWritable: true });

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export interface TradeParams {
  battleId: bigint | number;
  trader: string;
  battle: BattleAccounts;
  /** true to trade artist A's side, false for B. */
  artistA: boolean;
  /**
   * Unix seconds after which the program rejects the trade. The trader's
   * protection against a transaction sitting unconfirmed while the price moves;
   * there is no sensible default, so callers set it (see `deadlineIn`).
   */
  deadline: bigint | number;
}

export interface BuyParams extends TradeParams {
  /** Lamports of SOL to spend. */
  amountLamports: bigint | number;
  /**
   * Slippage floor: fewer tokens than this and the program reverts. Zero
   * disables the check, which is why it is required rather than defaulted -
   * an unset floor is a real risk and it should be visible at the call site.
   */
  minTokensOut: bigint | number;
}

export interface SellParams extends TradeParams {
  /** Tokens to sell, in the mint's base units. */
  amountTokens: bigint | number;
  /** Slippage floor in lamports. Same reasoning as `minTokensOut`. */
  minSolOut: bigint | number;
}

/** Both trading instructions take the same thirteen accounts in the same order. */
function tradeAccounts(
  battleId: bigint | number,
  trader: string,
  battle: BattleAccounts,
): AccountMeta[] {
  const mintA = mintPda(battleId, "a");
  const mintB = mintPda(battleId, "b");
  return [
    w(battlePda(battleId)),
    w(mintA),
    w(mintB),
    w(associatedTokenAddress(trader, mintA)),
    w(associatedTokenAddress(trader, mintB)),
    signer(trader),
    w(battle.wavewarzWallet),
    w(battle.artistA),
    w(battle.artistB),
    w(vaultPda(battleId)),
    r(TOKEN_PROGRAM_ID),
    r(SYSTEM_PROGRAM_ID),
    r(ASSOCIATED_TOKEN_PROGRAM_ID),
  ];
}

/**
 * A u64 field must be a whole, non-negative, finite number, and saying so here
 * is the difference between a usable SDK and a cryptic one.
 *
 * Without this, a caller who computes "sell 5% of my holdings" gets a float and
 * the failure arrives from four frames away as:
 *
 *     RangeError: The number 79001582.26263574 cannot be converted to a BigInt
 *     because it is not an integer
 *
 * which names neither the field nor the instruction. Every amount here is in
 * base units - lamports, or the mint's smallest unit - so a fraction is always
 * the caller's arithmetic leaking, never a legitimate value.
 *
 * `bigint` passes straight through: it is whole by construction, so only its
 * sign can be wrong. These fields accept either type because a u64 can exceed
 * `Number.MAX_SAFE_INTEGER` and a caller working at that size should not be
 * forced through a float.
 *
 * IT REFUSES RATHER THAN ROUNDS. Flooring silently would change the trade from
 * the one the caller asked for into a near neighbour, and on a slippage floor
 * that is the difference between protection and the appearance of it. The
 * caller decides how to round their own numbers; `withSlippage` already floors
 * the ones this library produces.
 */
/**
 * A slippage floor the program will accept.
 *
 * **ZERO IS REJECTED ON CHAIN, WITH `InvalidAmount` (6006).** Measured against
 * the deployed program on 2026-09-20: a buy identical in every other respect
 * succeeds at `minTokensOut: 1` and fails at `0`. "No slippage limit" is the
 * natural way to express an unprotected trade and it is the one value that
 * cannot be sent, so it is refused here with the reason rather than on chain
 * with a number.
 */
function slippageFloor(field: string, value: bigint | number): bigint | number {
  const v = whole(field, value);
  if (v === 0 || v === 0n) {
    throw new Error(
      `${field} must be at least 1; the program rejects 0 with InvalidAmount (6006). ` +
        "To trade without slippage protection, pass 1, not 0.",
    );
  }
  return v;
}

function whole(field: string, value: bigint | number): bigint | number {
  // A bigint is a whole number by construction, so only its sign can be wrong.
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error(`${field} must be non-negative, got ${value}`);
    }
    return value;
  }
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(
      `${field} must be a whole non-negative number of base units, got ${value}. ` +
        "Round it yourself - this library will not guess which way.",
    );
  }
  return value;
}

export function buySharesInstruction(p: BuyParams): Instruction {
  return {
    programId: PROGRAM_ID,
    keys: tradeAccounts(p.battleId, p.trader, p.battle),
    data: concat([
      Uint8Array.from(DISCRIMINATOR.buyShares),
      u64le(whole("amountLamports", p.amountLamports)),
      Uint8Array.from([p.artistA ? 1 : 0]),
      u64le(slippageFloor("minTokensOut", p.minTokensOut)),
      i64le(p.deadline),
    ]),
  };
}

export function sellSharesInstruction(p: SellParams): Instruction {
  return {
    programId: PROGRAM_ID,
    keys: tradeAccounts(p.battleId, p.trader, p.battle),
    data: concat([
      Uint8Array.from(DISCRIMINATOR.sellShares),
      u64le(whole("amountTokens", p.amountTokens)),
      Uint8Array.from([p.artistA ? 1 : 0]),
      u64le(slippageFloor("minSolOut", p.minSolOut)),
      i64le(p.deadline),
    ]),
  };
}

/**
 * Claim a settled battle's winnings. Takes no arguments: the program works out
 * what is owed from the trader's token balances, which is why a claim cannot be
 * partial and cannot be aimed at one side.
 */
/**
 * Settle a battle whose clock has run out.
 *
 * NOT ONE OF THESE SEVEN ACCOUNTS IS A SIGNER, and that is the whole character
 * of this instruction. `endBattle` is permissionless: no admin key, no
 * cooperation from the platform, nothing but a fee payer to cover about
 * 0.000005 SOL and ~22,000 compute units. Verified against a real settled
 * transaction - its only signer is the fee payer, and that wallet appears
 * nowhere in the instruction.
 *
 * IT TAKES NO ARGUMENTS EITHER, and that follows from the same fact. If it
 * accepted a winner, anyone could pass any winner and drain the losing pool to
 * whichever side they liked. So the program works the winner out itself, from
 * the only thing it holds: the two pools. That is why the settlement winner is
 * always the larger pool, with no exception in 1,482 settled battles, and why a
 * battle has two winners rather than one.
 *
 * WHY THE SDK HAS IT AND THE RELAY DOES NOT. `relayPolicy.ts` deliberately
 * refuses to relay this, because relaying one would settle a battle in our
 * name. A front end building it for its own user to sign is a different act
 * entirely, and until now no front end could do that at all - the technique
 * existed only as a procedure for a human in `docs/SOP.md` SOP 1. 81 battles
 * were past their clock and unsettled on 2026-09-20, and a claim against any of
 * them fails until somebody calls this.
 *
 * SIMULATE IT FIRST. `sigVerify: false` against the deployed program costs
 * nothing, needs no wallet, and returns the program's own words rather than a
 * hex code. Expect `Battle ended successfully`.
 */
/**
 * Launch a battle.
 *
 * ANYONE CAN, AND ZAAL CONFIRMED IT ON 2026-09-20: "anyone can launch a battle
 * anyone can build a front end." The chain already said so - the transaction
 * this was decoded from was signed by his own wallet, not the platform's, and
 * the only signer in the instruction is the creator paying the rent.
 *
 * DECODED FROM A REAL LAUNCH RATHER THAN FROM A GUESS. Battle 1788580997, the
 * newest in the committed census, read back from its own oldest signature.
 * Eight accounts, 32 bytes of data, and every field checked against the census
 * afterwards: the three arguments are the battle id, the DURATION in seconds,
 * and the start time. That middle one is the trap - the account stores
 * `end_time`, so a caller who passes an end time gets a battle that lasts until
 * the heat death of the universe, and the field name here says `durationSeconds`
 * for that reason.
 *
 * THE BATTLE ID IS THE START TIME. Not an index, not a counter. Every battle
 * on chain has `battle_id == start_time`, which is why the id range guard in
 * `discovery.ts` is a date range. Passing a small integer derives a
 * well-formed PDA for a battle that will never exist.
 *
 * COSTS THE CREATOR ABOUT 0.004 SOL IN RENT and nothing else. The published
 * launch fees - 0.69 SOL quick, 4 SOL community - are NOT charged: twenty
 * creations were inspected on chain 2026-09-06 and the platform's wallet
 * received nothing in any of them. See `lib/feeModel.ts`.
 *
 * `relayPolicy.ts` still refuses to RELAY this, and that stays true. Building
 * an instruction for someone else's wallet to sign is not launching a battle in
 * our name.
 */
export function initializeBattleInstruction(p: {
  /** The battle id, which IS the start time in unix seconds. */
  battleId: bigint | number;
  /** Who signs and pays the rent. Any wallet. */
  creator: string;
  artistA: string;
  artistB: string;
  /** The platform's fee wallet, which receives the platform share of trades. */
  wavewarzWallet: string;
  /** How long the battle runs, in SECONDS. Not an end time. */
  durationSeconds: bigint | number;
  /** Unix seconds. Defaults to the battle id, which is what every real launch does. */
  startTime?: bigint | number;
}): Instruction {
  const start = p.startTime ?? p.battleId;
  return {
    programId: PROGRAM_ID,
    keys: [
      w(battlePda(p.battleId)),
      signer(p.creator),
      r(p.artistA),
      r(p.artistB),
      r(p.wavewarzWallet),
      w(vaultPda(p.battleId)),
      r(SYSTEM_PROGRAM_ID),
      r(RENT_SYSVAR),
    ],
    data: concat([
      Uint8Array.from(DISCRIMINATOR.initializeBattle),
      u64le(whole("battleId", p.battleId)),
      i64le(whole("durationSeconds", p.durationSeconds)),
      i64le(whole("startTime", start)),
    ]),
  };
}

/**
 * Create a battle's two share mints. **STEP TWO OF LAUNCHING, NOT AN OPTIONAL
 * EXTRA.**
 *
 * `initializeBattle` creates the battle and its vault and nothing else. Until
 * this runs, the battle has no mints, so `buyShares` has nothing to mint into
 * and the battle cannot be traded. A front end that calls only
 * `initializeBattle` produces a dead page.
 *
 * FOUND BY MEASURING, AFTER THIS FILE ASSERTED THE OPPOSITE. An earlier note
 * here said mints were "separate" and handled by the trader's own first
 * transaction. That is true of the trader's ASSOCIATED TOKEN ACCOUNTS and false
 * of the mints themselves, and the two were conflated. 200 real program
 * transactions were sampled on 2026-09-20 and bucketed by discriminator:
 * `InitializeMints` was 7.5% of them, the one instruction the SDK did not know.
 * Nothing in the estate's docs mentioned it.
 *
 * ANYONE CAN CALL IT. Of the three launches inspected, two were signed by the
 * platform's fee wallet and one by `HegpwNycqbtc8GCPEkNCK9ToWPiuccw1wRewvi4Dsjkp`,
 * which is neither the fee wallet nor an artist. The signer is simply whoever
 * pays the rent for two mint accounts.
 *
 * Seven accounts, no arguments: the discriminator alone is the whole 8-byte
 * payload. Both mint PDAs derive from the battle id, so this instruction cannot
 * be pointed at a battle other than the one whose id it was built with.
 */
export function initializeMintsInstruction(p: {
  battleId: bigint | number;
  /** Who signs and pays rent on the two mints. Any wallet. */
  payer: string;
}): Instruction {
  return {
    programId: PROGRAM_ID,
    keys: [
      w(battlePda(p.battleId)),
      w(mintPda(p.battleId, "a")),
      w(mintPda(p.battleId, "b")),
      signer(p.payer),
      r(TOKEN_PROGRAM_ID),
      r(SYSTEM_PROGRAM_ID),
      r(RENT_SYSVAR),
    ],
    data: Uint8Array.from(DISCRIMINATOR.initializeMints),
  };
}

/**
 * Launch a battle, completely, in one call.
 *
 * **BECAUSE HALF A LAUNCH LOOKS EXACTLY LIKE A WHOLE ONE.** `initializeBattle`
 * alone returns `err: null`, writes a well-formed 353-byte battle account,
 * derives the PDA a front end would show, and logs "Battle initialized". It
 * also leaves no mints, so nothing can ever be bought and the page is dead. The
 * only way to tell the two apart is to go looking for an account that is not
 * there.
 *
 * A failure that silent does not belong behind an ordering a caller has to
 * know. Both instructions go in one transaction, so the battle either exists
 * and is tradeable or does not exist at all.
 *
 * Simulated together on 2026-09-20: `err: null`, 43,179 compute units, two
 * 82-byte SPL mints owned by the token program.
 *
 * The two builders stay exported for anyone repairing a battle that was
 * launched without mints. This is the path for making a new one.
 */
export function launchBattleInstructions(p: {
  battleId: bigint | number;
  /** Signs both, pays rent on the battle, the vault and the two mints. */
  creator: string;
  artistA: string;
  artistB: string;
  wavewarzWallet: string;
  /** SECONDS, not an end time. See `initializeBattleInstruction`. */
  durationSeconds: bigint | number;
  startTime?: bigint | number;
}): Instruction[] {
  return [
    initializeBattleInstruction(p),
    initializeMintsInstruction({ battleId: p.battleId, payer: p.creator }),
  ];
}

export function endBattleInstruction(p: {
  battleId: bigint | number;
  battle: BattleAccounts;
}): Instruction {
  return {
    programId: PROGRAM_ID,
    keys: [
      w(battlePda(p.battleId)),
      w(vaultPda(p.battleId)),
      w(p.battle.artistA),
      w(p.battle.artistB),
      w(p.battle.wavewarzWallet),
      r(SYSTEM_PROGRAM_ID),
      r(RENT_SYSVAR),
    ],
    data: Uint8Array.from(DISCRIMINATOR.endBattle),
  };
}

export function claimSharesInstruction(p: {
  battleId: bigint | number;
  trader: string;
}): Instruction {
  const mintA = mintPda(p.battleId, "a");
  const mintB = mintPda(p.battleId, "b");
  return {
    programId: PROGRAM_ID,
    keys: [
      w(battlePda(p.battleId)),
      w(vaultPda(p.battleId)),
      signer(p.trader),
      w(associatedTokenAddress(p.trader, mintA)),
      w(associatedTokenAddress(p.trader, mintB)),
      w(mintA),
      w(mintB),
      r(TOKEN_PROGRAM_ID),
      r(SYSTEM_PROGRAM_ID),
    ],
    data: Uint8Array.from(DISCRIMINATOR.claimShares),
  };
}

/**
 * Create the trader's associated token account for one mint, or do nothing if it
 * already exists.
 *
 * WHY THIS IS NEEDED AT ALL, and why no test in this repo found that out.
 * `buyShares` lists `associatedTokenProgram` among its accounts, which reads like
 * the program creates the trader's token accounts by CPI. It does not. A first
 * trade from a wallet that has never held either side of that battle fails with
 * Anchor's "The program expected this account to be already initialized" after
 * about 9,700 compute units - before it ever reaches the battle logic.
 *
 * Measured, not assumed, twice over. All thirteen accounts of the failing buy
 * were checked on mainnet: eleven exist, and the two missing ones are exactly the
 * trader's two token accounts. Then thirteen real transactions against the same
 * battle PDA were read: four of them prepend TWO ATA instructions before the
 * WaveWarZ one, nine do not - the four are the first-time traders. So the client
 * creates these accounts, and every working client on chain already does.
 *
 * THE FIXTURE COULD NOT HAVE CAUGHT THIS. `__fixtures__/ww-buy-transaction.json`
 * is a real mainnet buy whose trader had already traded that battle, so his token
 * accounts existed and his transaction has no ATA instruction in it. The fixture
 * is real, it reproduces exactly, and it was captured from a starting state that
 * hid a requirement. A real example is evidence about the state it came from.
 *
 * WHY IDEMPOTENT RATHER THAN THE PLAIN `Create` THE CHAIN SAMPLES USE. Plain
 * `Create` fails the whole transaction if the account already exists, so a client
 * using it must check first - and a check is a fact about the moment it was made.
 * The widget rebuilds its transaction immediately before signing (the blockhash
 * goes stale), and between check and signature the same wallet can trade the same
 * battle in another tab. `CreateIdempotent` returns early instead of reverting,
 * which removes the window and the check with it.
 *
 * The cost of including these when the accounts already exist was measured on
 * mainnet rather than guessed: the same buy simulated at 30,069 units without
 * them and 44,743 with, so about 7,300 units per no-op creation and no lamports.
 * Both simulations reached the same program error at the same point, which is
 * what idempotent means here - the extra instructions changed the cost and
 * nothing else.
 *
 * The six accounts and their order are copied from a real ATA instruction on
 * chain, not recalled - see `__fixtures__/ww-ata-create-transaction.json`. The
 * one-byte discriminator is the difference between that instruction and this one,
 * and it is checked by simulating against the deployed ATA program.
 *
 * NO NEW ACCOUNTS REACH THE MESSAGE. Every one of the six is already in a buy or
 * sell: the trader signs and pays, the token account and mint are already
 * writable, and both programs are already there. So prepending these does not
 * change the compiled account list at all, only the instruction list - which is
 * asserted in the tests, because a change there would move every index.
 */
export function createAssociatedTokenAccountIdempotentInstruction(p: {
  /** Pays the rent. The trader, in every case this repo builds. */
  funder: string;
  /** Who the token account belongs to. */
  owner: string;
  mint: string;
}): Instruction {
  return {
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      signer(p.funder),
      w(associatedTokenAddress(p.owner, p.mint)),
      r(p.owner),
      r(p.mint),
      r(SYSTEM_PROGRAM_ID),
      r(TOKEN_PROGRAM_ID),
    ],
    // 0 is Create, 1 is CreateIdempotent. The legacy encoding is an empty data
    // field, which is what the real transactions on chain carry.
    data: Uint8Array.from([1]),
  };
}

/**
 * Both of the trader's token accounts for a battle, created if absent.
 *
 * Returned as a pair because a trade touches both sides: `buyShares` names
 * artist A's and artist B's token accounts whichever side is being bought, so
 * creating only the side being traded still fails on the other one.
 */
export function traderTokenAccountInstructions(
  battleId: bigint | number,
  trader: string,
): Instruction[] {
  return (["a", "b"] as const).map((side) =>
    createAssociatedTokenAccountIdempotentInstruction({
      funder: trader,
      owner: trader,
      mint: mintPda(battleId, side),
    }),
  );
}

/** Seconds from now, as the program wants it. */
export const deadlineIn = (seconds: number, now = Date.now()): number =>
  Math.floor(now / 1000) + seconds;

/**
 * The three wallets, read from a raw battle account. Offsets are
 * chain/BATTLE-ACCOUNT.md, reconciled with the indexer's parser on 2026-09-06.
 */
export function battleAccountsFromRaw(raw: Uint8Array): BattleAccounts {
  if (raw.length < 132) throw new Error(`battle account too short: ${raw.length} bytes`);
  return {
    artistA: b58encode(raw.slice(36, 68)),
    artistB: b58encode(raw.slice(68, 100)),
    wavewarzWallet: b58encode(raw.slice(100, 132)),
  };
}
