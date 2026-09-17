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
} as const;

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

export function buySharesInstruction(p: BuyParams): Instruction {
  return {
    programId: PROGRAM_ID,
    keys: tradeAccounts(p.battleId, p.trader, p.battle),
    data: concat([
      Uint8Array.from(DISCRIMINATOR.buyShares),
      u64le(p.amountLamports),
      Uint8Array.from([p.artistA ? 1 : 0]),
      u64le(p.minTokensOut),
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
      u64le(p.amountTokens),
      Uint8Array.from([p.artistA ? 1 : 0]),
      u64le(p.minSolOut),
      i64le(p.deadline),
    ]),
  };
}

/**
 * Claim a settled battle's winnings. Takes no arguments: the program works out
 * what is owed from the trader's token balances, which is why a claim cannot be
 * partial and cannot be aimed at one side.
 */
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
