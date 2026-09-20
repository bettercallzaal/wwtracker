/**
 * The builder is checked against chain, not against itself.
 *
 * `__fixtures__/ww-buy-transaction.json` is a real mainnet buy - signature
 * 4XqZHbqd..., slot 433994465, 0.03 SOL on artist B - captured with the battle
 * account it traded against. If this module can reproduce that transaction's 33
 * data bytes and all 13 accounts in order, it produces what wavewarz.com already
 * produces. That is a claim about the world; a test that only exercised these
 * functions against each other would not be.
 *
 * The red controls matter as much as the green one: a builder that derived the
 * wrong PDA, ordered accounts wrongly, or set the wrong writable flags would
 * still return a plausible-looking object. Several cases below mutate exactly
 * one thing and require the comparison to fail.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-buy-transaction.json";
import {
  battleAccountsFromRaw,
  buySharesInstruction,
  claimSharesInstruction,
  deadlineIn,
  sellSharesInstruction,
} from "../ww/instructions";
import {
  PROGRAM_ID,
  associatedTokenAddress,
  b58decode,
  b58encode,
  battlePda,
  mintPda,
  vaultPda,
} from "../ww/pda";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const rawBattle = new Uint8Array(Buffer.from(fixture.battle_account_base64, "base64"));
const battle = battleAccountsFromRaw(rawBattle);
const trader = fixture.accounts_in_order[5];

describe("base58 round-trips", () => {
  it("decodes and re-encodes every account in the fixture", () => {
    for (const a of fixture.accounts_in_order) {
      expect(b58encode(b58decode(a))).toBe(a);
    }
  });

  it("keeps leading zero bytes, which is what makes the system program id 32 ones", () => {
    expect(b58encode(new Uint8Array(32))).toBe("11111111111111111111111111111111");
    expect(b58decode("11111111111111111111111111111111").length).toBe(32);
  });
});

describe("the battle account's three wallets", () => {
  it("reads the wallets the real transaction used, at offsets 36, 68 and 100", () => {
    expect(battle.artistA).toBe(fixture.accounts_in_order[7]);
    expect(battle.artistB).toBe(fixture.accounts_in_order[8]);
    expect(battle.wavewarzWallet).toBe(fixture.accounts_in_order[6]);
  });

  it("refuses a truncated account rather than returning a plausible wallet", () => {
    expect(() => battleAccountsFromRaw(rawBattle.slice(0, 100))).toThrow(/too short/);
  });
});

describe("PDA derivation against the real transaction", () => {
  const id = fixture.battle_id;

  it("derives the battle, mints, token accounts and vault the transaction used", () => {
    expect(battlePda(id)).toBe(fixture.accounts_in_order[0]);
    expect(mintPda(id, "a")).toBe(fixture.accounts_in_order[1]);
    expect(mintPda(id, "b")).toBe(fixture.accounts_in_order[2]);
    expect(associatedTokenAddress(trader, mintPda(id, "a"))).toBe(
      fixture.accounts_in_order[3],
    );
    expect(associatedTokenAddress(trader, mintPda(id, "b"))).toBe(
      fixture.accounts_in_order[4],
    );
    expect(vaultPda(id)).toBe(fixture.accounts_in_order[9]);
  });

  it("gives a different address for a different battle id - the seed is load-bearing", () => {
    expect(battlePda(id + 1)).not.toBe(battlePda(id));
    expect(mintPda(id, "a")).not.toBe(mintPda(id, "b"));
  });

  it("gives a different token account for a different owner", () => {
    const other = fixture.accounts_in_order[7];
    expect(associatedTokenAddress(other, mintPda(id, "a"))).not.toBe(
      fixture.accounts_in_order[3],
    );
  });
});

describe("buySharesInstruction reproduces the real transaction", () => {
  const ix = buySharesInstruction({
    battleId: fixture.battle_id,
    trader,
    battle,
    artistA: fixture.decoded_args.artist_a,
    amountLamports: fixture.decoded_args.amount_lamports,
    minTokensOut: fixture.decoded_args.min_tokens_out,
    deadline: fixture.decoded_args.deadline,
  });

  it("produces the same 33 data bytes", () => {
    expect(hex(ix.data)).toBe(fixture.instruction_data_hex);
  });

  it("produces the same 13 accounts, in the same order", () => {
    expect(ix.keys.map((k) => k.pubkey)).toEqual(fixture.accounts_in_order);
  });

  it("targets the deployed program", () => {
    expect(ix.programId).toBe(fixture.program_id);
    expect(ix.programId).toBe(PROGRAM_ID);
  });

  it("marks only the trader as signer, and only the three programs as read-only", () => {
    expect(ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey)).toEqual([trader]);
    expect(ix.keys.map((k) => k.isWritable)).toEqual([
      true, true, true, true, true, true, true, true, true, true, false, false, false,
    ]);
  });

  // The controls. Each changes exactly one input and requires the bytes to move.
  it("changes the bytes when the side changes", () => {
    const flipped = buySharesInstruction({
      battleId: fixture.battle_id,
      trader,
      battle,
      artistA: !fixture.decoded_args.artist_a,
      amountLamports: fixture.decoded_args.amount_lamports,
      minTokensOut: fixture.decoded_args.min_tokens_out,
      deadline: fixture.decoded_args.deadline,
    });
    expect(hex(flipped.data)).not.toBe(fixture.instruction_data_hex);
  });

  it("changes the bytes when the amount changes by one lamport", () => {
    const off = buySharesInstruction({
      battleId: fixture.battle_id,
      trader,
      battle,
      artistA: fixture.decoded_args.artist_a,
      amountLamports: fixture.decoded_args.amount_lamports + 1,
      minTokensOut: fixture.decoded_args.min_tokens_out,
      deadline: fixture.decoded_args.deadline,
    });
    expect(hex(off.data)).not.toBe(fixture.instruction_data_hex);
  });

  it("changes the accounts when the trader changes", () => {
    const other = buySharesInstruction({
      battleId: fixture.battle_id,
      trader: fixture.accounts_in_order[7],
      battle,
      artistA: fixture.decoded_args.artist_a,
      amountLamports: fixture.decoded_args.amount_lamports,
      minTokensOut: fixture.decoded_args.min_tokens_out,
      deadline: fixture.decoded_args.deadline,
    });
    expect(other.keys.map((k) => k.pubkey)).not.toEqual(fixture.accounts_in_order);
  });
});

describe("sellShares and claimShares", () => {
  const common = {
    battleId: fixture.battle_id,
    trader,
    battle,
    artistA: true,
    deadline: fixture.decoded_args.deadline,
  };

  it("sell takes the same thirteen accounts as buy, in the same order", () => {
    const buy = buySharesInstruction({
      ...common,
      amountLamports: 1,
      minTokensOut: 0,
    });
    const sell = sellSharesInstruction({ ...common, amountTokens: 1, minSolOut: 0 });
    expect(sell.keys).toEqual(buy.keys);
  });

  it("sell carries its own discriminator, not buy's", () => {
    const sell = sellSharesInstruction({ ...common, amountTokens: 1, minSolOut: 0 });
    expect(hex(sell.data).slice(0, 16)).toBe("b8a4a910e79ec7c4");
    expect(hex(sell.data).slice(0, 16)).not.toBe(fixture.instruction_data_hex.slice(0, 16));
    expect(sell.data.length).toBe(33);
  });

  it("claim takes nine accounts, no arguments, and only its discriminator", () => {
    const claim = claimSharesInstruction({ battleId: fixture.battle_id, trader });
    expect(hex(claim.data)).toBe("82831ded86146ef5");
    expect(claim.keys.map((k) => k.pubkey)).toEqual([
      fixture.accounts_in_order[0], // battle
      fixture.accounts_in_order[9], // vault
      trader,
      fixture.accounts_in_order[3], // artist A token
      fixture.accounts_in_order[4], // artist B token
      fixture.accounts_in_order[1], // artist A mint
      fixture.accounts_in_order[2], // artist B mint
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "11111111111111111111111111111111",
    ]);
    expect(claim.keys.filter((k) => k.isSigner).map((k) => k.pubkey)).toEqual([trader]);
  });
});

describe("deadlineIn", () => {
  it("is seconds from now, not milliseconds - a 1000x error here reads as a valid future date", () => {
    expect(deadlineIn(60, 1_700_000_000_000)).toBe(1_700_000_060);
  });

  it("matches the shape of the real transaction's deadline", () => {
    const real = fixture.decoded_args.deadline;
    expect(real).toBeGreaterThan(1_600_000_000);
    expect(real).toBeLessThan(2_000_000_000);
  });
});

/**
 * The guard a front end meets first. Every amount here is base units, so a
 * fraction is always the caller's arithmetic leaking through - "5% of my
 * holdings" is a float. Before this, that surfaced four frames away as a
 * BigInt RangeError naming neither the field nor the instruction.
 */
describe("whole-number amounts", () => {
  const common = {
    battleId: fixture.battle_id,
    trader,
    battle,
    artistA: true,
    deadline: 1_700_000_060,
  };

  it("names the field when a buy amount is fractional", () => {
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: 1.5, minTokensOut: 0 }),
    ).toThrow(/amountLamports must be a whole/);
  });

  it("names the field when a sell token amount is fractional", () => {
    expect(() =>
      sellSharesInstruction({ ...common, amountTokens: 79_001_582.26, minSolOut: 0 }),
    ).toThrow(/amountTokens must be a whole/);
  });

  it("catches a fractional slippage floor too, which is the dangerous one", () => {
    expect(() =>
      sellSharesInstruction({ ...common, amountTokens: 100, minSolOut: 12.7 }),
    ).toThrow(/minSolOut must be a whole/);
  });

  it("refuses rather than rounds, and says so", () => {
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: 1.5, minTokensOut: 0 }),
    ).toThrow(/will not guess which way/);
  });

  it("rejects negative and non-finite amounts", () => {
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: -1, minTokensOut: 0 }),
    ).toThrow(/whole non-negative/);
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: NaN, minTokensOut: 0 }),
    ).toThrow(/whole non-negative/);
  });

  it("still accepts whole values", () => {
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: 10_000_000, minTokensOut: 0 }),
    ).not.toThrow();
  });

  /**
   * These fields take bigint as well as number, because a u64 can exceed
   * Number.MAX_SAFE_INTEGER. A bigint is whole by construction, so the guard
   * must let it through and check only its sign - a first version typed the
   * parameter as `number` and failed the build rather than any test.
   */
  it("passes bigint straight through", () => {
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: 10_000_000n, minTokensOut: 0n }),
    ).not.toThrow();
    expect(() =>
      sellSharesInstruction({ ...common, amountTokens: 9_007_199_254_740_993n, minSolOut: 0n }),
    ).not.toThrow();
  });

  it("still rejects a negative bigint", () => {
    expect(() =>
      sellSharesInstruction({ ...common, amountTokens: -1n, minSolOut: 0n }),
    ).toThrow(/amountTokens must be non-negative/);
  });
});
