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
  RENT_SYSVAR,
  battleAccountsFromRaw,
  buySharesInstruction,
  claimSharesInstruction,
  deadlineIn,
  initializeBattleInstruction,
  initializeMintsInstruction,
  launchBattleInstructions,
  sellSharesInstruction,
} from "../ww/instructions";
import {
  PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
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
      minTokensOut: 1,
    });
    const sell = sellSharesInstruction({ ...common, amountTokens: 1, minSolOut: 1 });
    expect(sell.keys).toEqual(buy.keys);
  });

  it("sell carries its own discriminator, not buy's", () => {
    const sell = sellSharesInstruction({ ...common, amountTokens: 1, minSolOut: 1 });
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
      buySharesInstruction({ ...common, amountLamports: 1.5, minTokensOut: 1 }),
    ).toThrow(/amountLamports must be a whole/);
  });

  it("names the field when a sell token amount is fractional", () => {
    expect(() =>
      sellSharesInstruction({ ...common, amountTokens: 79_001_582.26, minSolOut: 1 }),
    ).toThrow(/amountTokens must be a whole/);
  });

  it("catches a fractional slippage floor too, which is the dangerous one", () => {
    expect(() =>
      sellSharesInstruction({ ...common, amountTokens: 100, minSolOut: 12.7 }),
    ).toThrow(/minSolOut must be a whole/);
  });

  it("refuses rather than rounds, and says so", () => {
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: 1.5, minTokensOut: 1 }),
    ).toThrow(/will not guess which way/);
  });

  it("rejects negative and non-finite amounts", () => {
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: -1, minTokensOut: 1 }),
    ).toThrow(/whole non-negative/);
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: NaN, minTokensOut: 1 }),
    ).toThrow(/whole non-negative/);
  });

  it("still accepts whole values", () => {
    expect(() =>
      buySharesInstruction({ ...common, amountLamports: 10_000_000, minTokensOut: 1 }),
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
      buySharesInstruction({ ...common, amountLamports: 10_000_000n, minTokensOut: 1n }),
    ).not.toThrow();
    expect(() =>
      sellSharesInstruction({ ...common, amountTokens: 9_007_199_254_740_993n, minSolOut: 1n }),
    ).not.toThrow();
  });

  it("still rejects a negative bigint", () => {
    expect(() =>
      sellSharesInstruction({ ...common, amountTokens: -1n, minSolOut: 1n }),
    ).toThrow(/amountTokens must be non-negative/);
  });
});

/**
 * Launching, against the real launch it was decoded from.
 *
 * Battle 1788580997 is the newest in the committed census. Its `initializeBattle`
 * transaction was read back from chain on 2026-09-20 and every assertion below
 * compares to those bytes rather than to the shape this module wishes they had.
 *
 * The first test is the whole point: 32 bytes rebuilt, byte for byte. A test
 * that only checked "the discriminator is first and there are three u64s" would
 * pass on an argument ORDER that is wrong, and the order is the trap - the
 * middle field is a duration and the account stores an end time.
 */
describe("initializeBattleInstruction reproduces a real launch", () => {
  // Read from the oldest signature on battle PDA GRsy35X6VgB44JjfEZHRgrb8VxcTqqCzSNm7GPVJL6KP.
  const REAL = {
    battleId: 1_788_580_997,
    // The creator is ZAAL'S OWN WALLET, not the platform's. The chain said
    // "anyone can launch" before Zaal ruled it on 2026-09-20.
    creator: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
    artistA: "ASpsqT7qKbHF7VhsBPYGRk95vNyAgPuhTBoh2o7ptRLb",
    artistB: "BYshzR3KeycopC1o7iynYp224AM3psAUziV35Nyha8Ns",
    wavewarzWallet: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37",
    durationSeconds: 541,
    battlePda: "GRsy35X6VgB44JjfEZHRgrb8VxcTqqCzSNm7GPVJL6KP",
    vaultPda: "Fk7kK7SV8sETB9TkRtCzAYthwXNKTuvPaZXQSBhYtkCK",
    data: "756ca69f9252f6df85949b6a000000001d0200000000000085949b6a00000000",
  };
  const ix = initializeBattleInstruction(REAL);
  const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

  it("rebuilds the transaction's 32 data bytes exactly", () => {
    expect(hex(ix.data)).toBe(REAL.data);
  });

  it("puts the DURATION in the middle field, not the end time", () => {
    // 541 seconds = 0x21d. An end time here would be ~1.79e9 and the battle
    // would run for 56 years, which is why this has its own assertion.
    const view = new DataView(ix.data.buffer, ix.data.byteOffset, ix.data.byteLength);
    expect(view.getBigInt64(16, true)).toBe(541n);
    expect(view.getBigUint64(8, true)).toBe(BigInt(REAL.battleId));
    // Start time defaults to the battle id, which is what every real launch does.
    expect(view.getBigInt64(24, true)).toBe(BigInt(REAL.battleId));
  });

  it("derives both PDAs to the accounts the real transaction used", () => {
    expect(ix.keys[0].pubkey).toBe(REAL.battlePda);
    expect(ix.keys[5].pubkey).toBe(REAL.vaultPda);
  });

  it("orders the eight accounts as the program expects them", () => {
    expect(ix.keys.map((k) => k.pubkey)).toEqual([
      REAL.battlePda,
      REAL.creator,
      REAL.artistA,
      REAL.artistB,
      REAL.wavewarzWallet,
      REAL.vaultPda,
      SYSTEM_PROGRAM_ID,
      RENT_SYSVAR,
    ]);
  });

  it("asks ONE wallet to sign, and it is the creator paying the rent", () => {
    // Not the platform. A front end can launch with any wallet it holds.
    const signers = ix.keys.filter((k) => k.isSigner);
    expect(signers).toHaveLength(1);
    expect(signers[0].pubkey).toBe(REAL.creator);
    expect(signers[0].isWritable).toBe(true);
  });

  it("writes only what it creates, and leaves the three wallets read-only", () => {
    expect(ix.keys.filter((k) => k.isWritable).map((k) => k.pubkey)).toEqual([
      REAL.battlePda,
      REAL.creator,
      REAL.vaultPda,
    ]);
  });

  it("takes an explicit start time when a caller schedules ahead", () => {
    const later = initializeBattleInstruction({ ...REAL, startTime: REAL.battleId + 600 });
    const view = new DataView(later.data.buffer, later.data.byteOffset, later.data.byteLength);
    expect(view.getBigInt64(24, true)).toBe(BigInt(REAL.battleId + 600));
    // The id, and so both PDAs, are unchanged by scheduling.
    expect(later.keys[0].pubkey).toBe(REAL.battlePda);
  });

  it("refuses a fractional duration rather than truncating it", () => {
    expect(() => initializeBattleInstruction({ ...REAL, durationSeconds: 541.5 })).toThrow(
      /durationSeconds/,
    );
  });

  it("refuses a negative duration, which would end the battle before it starts", () => {
    expect(() => initializeBattleInstruction({ ...REAL, durationSeconds: -1 })).toThrow(
      /durationSeconds/,
    );
  });
});

/**
 * `initializeMints`, decoded from three real launches.
 *
 * FOUND BY COUNTING, NOT BY READING. 200 real program transactions were sampled
 * on 2026-09-20 and bucketed by discriminator. Five buckets were instructions
 * this library already built; one, at 7.5% of all traffic, was not, and nothing
 * in the estate's docs mentioned it. A battle launched without it has no mints,
 * so nothing can be bought and the page is dead.
 */
describe("initializeMintsInstruction", () => {
  const REAL = [
    { battleId: 1789790992, battle: "H733cPQkBgwfJAzDuAwVri8rzJfYJPQ11EoCDaHC2FEX",
      mintA: "8UWiSgMpWM3j7yuddvvFa8cf8vLkBWDF8fmSEWqPQ7WR", mintB: "AdQtLRJ3nBQFrLG9VqRdDYodSotFjeqAUKNPsNZCw1XP",
      payer: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37" },
    { battleId: 1789789481, battle: "GReSnPyXyVZmRRJL9TwvLgkm5rbhzWbGE8gTKTQqBNLr",
      mintA: "HsoHLcyiZ53a94G9xeYSE8feRtBkcK6zwuujXDfLyF3j", mintB: "2mLJJW6kZDXLhzt74WLxqvAcRduPHdBL3sUJYdq6SJa9",
      payer: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37" },
    // Signed by a wallet that is neither the fee wallet nor an artist, which is
    // the on-chain half of "anyone can launch".
    { battleId: 1789787784, battle: "7H4a8C86Quo9JtNLH9V57LPdR5Dygu3jKepRxf6ZXULv",
      mintA: "4yj19bVdDec4n1hZz3G5TX6kVMEh8Y63zCL25zHBKENh", mintB: "HKP1cAEX9Je8jCovnAhLt6ZRwaaDuoJpVB88iqTfcsL3",
      payer: "HegpwNycqbtc8GCPEkNCK9ToWPiuccw1wRewvi4Dsjkp" },
  ];

  it("reproduces all three real transactions' accounts, in order", () => {
    for (const r of REAL) {
      const ix = initializeMintsInstruction({ battleId: r.battleId, payer: r.payer });
      expect(ix.keys.map((k) => k.pubkey)).toEqual([
        r.battle, r.mintA, r.mintB, r.payer, TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID, RENT_SYSVAR,
      ]);
    }
  });

  it("carries no arguments at all - the discriminator is the whole payload", () => {
    const ix = initializeMintsInstruction({ battleId: REAL[0].battleId, payer: REAL[0].payer });
    expect(ix.data).toHaveLength(8);
    expect(Buffer.from(ix.data).toString("hex")).toBe("bd54558eb1c83916");
  });

  it("asks one wallet to sign, and any wallet will do", () => {
    const ix = initializeMintsInstruction({ battleId: REAL[2].battleId, payer: REAL[2].payer });
    const signers = ix.keys.filter((k) => k.isSigner);
    expect(signers).toHaveLength(1);
    expect(signers[0].pubkey).toBe("HegpwNycqbtc8GCPEkNCK9ToWPiuccw1wRewvi4Dsjkp");
  });

  it("cannot be pointed at a different battle than its id", () => {
    // Every account but the payer derives from the battle id, so there is no
    // argument through which a caller could mint into somebody else's battle.
    const a = initializeMintsInstruction({ battleId: 1, payer: REAL[0].payer });
    const b = initializeMintsInstruction({ battleId: 2, payer: REAL[0].payer });
    expect(a.keys.slice(0, 3).map((k) => k.pubkey)).not.toEqual(b.keys.slice(0, 3).map((k) => k.pubkey));
  });
});

describe("the slippage floor the program insists on", () => {
  const common = {
    battleId: 1_749_170_107,
    trader: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
    battle: {
      artistA: "ASpsqT7qKbHF7VhsBPYGRk95vNyAgPuhTBoh2o7ptRLb",
      artistB: "BYshzR3KeycopC1o7iynYp224AM3psAUziV35Nyha8Ns",
      wavewarzWallet: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37",
    },
    artistA: true,
    deadline: 1,
  };

  it("refuses minTokensOut of 0, which the program rejects with 6006", () => {
    expect(() => buySharesInstruction({ ...common, amountLamports: 1_000_000, minTokensOut: 0 }))
      .toThrow(/InvalidAmount \(6006\)/);
  });

  it("ALLOWS minSolOut of 0 on a sell, because the program does", () => {
    // The asymmetry, measured four ways against the deployed program on
    // 2026-09-20: a buy at 0 fails with InvalidAmount, a sell at 0 succeeds.
    // This guard refused both for about an hour. Refusing a value the chain
    // accepts is the same class of error as sending one it rejects - quieter,
    // because it looks like safety - and no test could catch it while the
    // tests asserted the guard instead of the program.
    expect(() => sellSharesInstruction({ ...common, amountTokens: 100_000, minSolOut: 0 }))
      .not.toThrow();
  });

  it("says what to pass instead, because 0 is the obvious way to mean no limit", () => {
    expect(() => buySharesInstruction({ ...common, amountLamports: 1_000_000, minTokensOut: 0n }))
      .toThrow(/pass 1, not 0/);
  });

  it("accepts 1", () => {
    expect(() => buySharesInstruction({ ...common, amountLamports: 1_000_000, minTokensOut: 1 }))
      .not.toThrow();
  });
});

describe("launchBattleInstructions", () => {
  const p = {
    battleId: 1_788_580_997,
    creator: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
    artistA: "ASpsqT7qKbHF7VhsBPYGRk95vNyAgPuhTBoh2o7ptRLb",
    artistB: "BYshzR3KeycopC1o7iynYp224AM3psAUziV35Nyha8Ns",
    wavewarzWallet: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37",
    durationSeconds: 541,
  };

  it("returns both steps, battle before mints", () => {
    const ixs = launchBattleInstructions(p);
    expect(ixs).toHaveLength(2);
    expect(Buffer.from(ixs[0].data.slice(0, 8)).toString("hex")).toBe("756ca69f9252f6df");
    expect(Buffer.from(ixs[1].data).toString("hex")).toBe("bd54558eb1c83916");
  });

  it("is exactly the two builders, so neither can drift from it", () => {
    const [battle, mints] = launchBattleInstructions(p);
    expect(battle).toEqual(initializeBattleInstruction(p));
    expect(mints).toEqual(initializeMintsInstruction({ battleId: p.battleId, payer: p.creator }));
  });

  it("asks the creator to sign both, and nobody else to sign anything", () => {
    const signers = launchBattleInstructions(p).flatMap((ix) => ix.keys.filter((k) => k.isSigner));
    expect(signers).toHaveLength(2);
    expect(new Set(signers.map((k) => k.pubkey))).toEqual(new Set([p.creator]));
  });

  it("points both at the same battle", () => {
    const [battle, mints] = launchBattleInstructions(p);
    expect(mints.keys[0].pubkey).toBe(battle.keys[0].pubkey);
  });
});
