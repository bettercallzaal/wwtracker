/**
 * THE STANDING LIST OF MEASURED PROTOCOL FACTS, ASSERTED AGAINST THIS CLIENT.
 *
 * `zao-vault/projects/wavewarz-protocol-truths.md` is what has actually been
 * measured against the deployed program: not documentation, and in several
 * places a correction to documentation that was wrong. It was written
 * 2026-09-20.
 *
 * WHY THIS FILE EXISTS. On 2026-09-22 `lib/ww/settle.ts` shipped
 * `poolA >= poolB`, which said a tie goes to artist A. That vault file had
 * said the opposite since 09-20, naming battle 1789783495, which had already
 * settled to B on chain. The contradiction survived a day, a gate and a merge,
 * and it was caught by reading the file, which was one grep away the whole
 * time. A rule saying "grep it first" is the same kind of object as the note
 * that went unread. A failing test is not.
 *
 * WHY THE CLAIMS ARE COPIED HERE RATHER THAN PARSED FROM THE VAULT. CI checks
 * out this repository and not that one, so a test that reads `~/zao-vault`
 * would skip in the only place it matters, and a skipped check reads exactly
 * like a passing one. Each claim below therefore carries the sentence it comes
 * from, so the copy can be diffed against the source by eye, and the vault
 * file points here.
 *
 * WHAT IS NOT HERE. Claims about the CHAIN that no code can contradict - that
 * a buy with a zero floor is refused, that the battle id equals the start
 * time, that launch fees are not collected. Those are facts about the program,
 * not about this client, and asserting them here would prove nothing.
 */
import { describe, expect, it } from "vitest";
import {
  ARTIST_FEE_BPS,
  CURVE_K,
  DISCRIMINATOR_BY_NAME,
  PLATFORM_FEE_BPS,
  SETTLEMENT_LOSING_TRADERS,
  SETTLEMENT_WINNING_TRADERS,
  SUPPLY_QUANTUM,
  TRADE_FEE,
  claimSharesInstruction,
  decodeBattleAccountResponse,
  endBattleInstruction,
  feeSplit,
  minimumSpendLamports,
  settlePreview,
} from "../ww";
import { buySharesInstruction, initializeBattleInstruction, initializeMintsInstruction, sellSharesInstruction } from "../ww/instructions";

const TRADER = "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk";
const BATTLE_ID = 1_789_948_124;
const SOL = 1_000_000_000;

describe("the curve", () => {
  // "The constant is exactly 5e8." / "tokens ... / 100000 ) * 100000"
  it("uses 5e8 and a 100,000 step", () => {
    expect(CURVE_K).toBe(5e8);
    expect(SUPPLY_QUANTUM).toBe(100_000);
  });
});

describe("fees", () => {
  // "1.500% on every trade" / "Split 67/33 toward the artist."
  it("is 1.5% split 67/33", () => {
    expect(TRADE_FEE).toBe(0.015);
    expect(ARTIST_FEE_BPS).toBe(6_700);
    expect(PLATFORM_FEE_BPS).toBe(3_300);
  });

  // "on a 0.05 SOL buy, total 750,000, artist 502,500, platform 247,500"
  it("splits the program's own printed example exactly", () => {
    expect(feeSplit(750_000)).toEqual({ artistLamports: 502_500, platformLamports: 247_500 });
  });

  /**
   * "Both halves are floored independently and do not always sum. One sell
   * printed 61,063 + 30,076 against a fee of 91,140. One lamport stays in the
   * vault."
   *
   * The same vault line adds "Compute in basis points, never from a float
   * share: Math.floor(750000 * 0.33) is 247,499 and the program says 247,500."
   * THAT EXAMPLE IS WRONG and is not asserted here: `Math.floor(750000 * 0.33)`
   * is 247,500, because 0.33 rounds up in binary. Measured 2026-09-22 across
   * every fee from 1 to 3,000,000 lamports, the float route and the
   * basis-point route agree on all 3,000,000. The vault file has been
   * corrected. Basis points remain the right way to write it - an integer path
   * cannot drift at all, which is worth more than a count of cases that happen
   * to agree - but the client is not defended by a discrepancy that does not
   * exist, and a test asserting one would fail for the right reason.
   */
  it("floors each half independently, one lamport short of the fee", () => {
    const split = feeSplit(91_140);
    expect(split).toEqual({ artistLamports: 61_063, platformLamports: 30_076 });
    expect(split.artistLamports + split.platformLamports).toBe(91_139);
    expect(feeSplit(750_000).platformLamports).toBe(247_500);
  });
});

describe("settlement", () => {
  /**
   * "A tie settles to artist B - the program's own Tie detected! branch. Seen
   * in the wild: battle 1789783495 closed 0.0493 against 0.0493 and went B."
   * Read from chain 2026-09-22: byte 245 is 1, byte 244 is 0.
   */
  it("gives a tie to B, which is what battle 1789783495 actually paid", () => {
    expect(settlePreview(49_250_000, 49_250_000).winner).toBe("b");
    expect(settlePreview(49_250_001, 49_250_000).winner).toBe("a");
  });

  // "50% refunded to losing traders, 40% to winning traders" and 10% leaving.
  it("pays 40 to the winners and 50 to the losers out of the losing pool, and 10 leaves", () => {
    expect(SETTLEMENT_WINNING_TRADERS).toBe(0.4);
    expect(SETTLEMENT_LOSING_TRADERS).toBe(0.5);
    const p = settlePreview(1_000_000, 0);
    const legs = settlePreview(0, 1_000_000);
    expect(p.loserPoolLamports).toBe(0);
    expect(legs.winnerShareFromLoser).toBe(0);
    const real = settlePreview(1_488_815_340, 37_886_360);
    expect(real.winnerShareFromLoser).toBe(15_154_544);
    expect(real.loserSharePool).toBe(18_943_180);
    expect(real.winnerShareFromLoser + real.loserSharePool + real.leavesVaultLamports).toBe(real.loserPoolLamports);
  });
});

describe("the account layout", () => {
  /**
   * "196 artist_a_supply, 204 artist_b_supply, 212 artist_a_sol_balance,
   * 220 artist_b_sol_balance, 244 winner_artist_a, 245 winner_decided" - and
   * "reading ACROSS the pairs is the mistake".
   *
   * Asserted through the real decoder rather than against a constants table,
   * so a decoder that stopped using the table would still be caught.
   */
  it("reads supply at 196 and 204, pools at 212 and 220, and both winner bytes", () => {
    const raw = new Uint8Array(353);
    const dv = new DataView(raw.buffer);
    dv.setBigUint64(8, BigInt(BATTLE_ID), true);
    dv.setBigUint64(196, 1_111n, true);
    dv.setBigUint64(204, 2_222n, true);
    dv.setBigUint64(212, 3_333n, true);
    dv.setBigUint64(220, 4_444n, true);
    raw[244] = 0;
    raw[245] = 1;
    const decoded = decodeBattleAccountResponse(raw);
    expect(decoded.supplyA).toBe(1_111);
    expect(decoded.supplyB).toBe(2_222);
    expect(decoded.poolALamports).toBe(3_333);
    expect(decoded.poolBLamports).toBe(4_444);
    expect(decoded.winnerArtistA).toBe(false);
    expect(decoded.settled).toBe(true);
  });
});

describe("the instruction set", () => {
  // "Six, and only six - confirmed two ways."
  it("is six instructions and no more", () => {
    expect(Object.keys(DISCRIMINATOR_BY_NAME).sort()).toEqual([
      "buyShares", "claimShares", "endBattle", "initializeBattle", "initializeMints", "sellShares",
    ]);
  });

  // The account counts in the vault file's table.
  it("builds each one with the account count that was counted on chain", () => {
    const battle = { artistA: TRADER, artistB: TRADER, wavewarzWallet: TRADER };
    const counts = {
      initializeBattle: initializeBattleInstruction({ battleId: BATTLE_ID, creator: TRADER, artistA: TRADER, artistB: TRADER, wavewarzWallet: TRADER, durationSeconds: 541 }).keys.length,
      initializeMints: initializeMintsInstruction({ battleId: BATTLE_ID, payer: TRADER }).keys.length,
      buyShares: buySharesInstruction({ battleId: BATTLE_ID, trader: TRADER, battle, artistA: true, amountLamports: 1, minTokensOut: 1, deadline: 1 }).keys.length,
      sellShares: sellSharesInstruction({ battleId: BATTLE_ID, trader: TRADER, battle, artistA: true, amountTokens: 1, minSolOut: 1, deadline: 1 }).keys.length,
      endBattle: endBattleInstruction({ battleId: BATTLE_ID, battle }).keys.length,
      claimShares: claimSharesInstruction({ battleId: BATTLE_ID, trader: TRADER }).keys.length,
    };
    expect(counts).toEqual({
      initializeBattle: 8, initializeMints: 7, buyShares: 13, sellShares: 13, endBattle: 7, claimShares: 9,
    });
  });

  // "endBattle is permissionless - seven accounts and not one is a signer."
  it("gives endBattle no signer at all", () => {
    const ix = endBattleInstruction({ battleId: BATTLE_ID, battle: { artistA: TRADER, artistB: TRADER, wavewarzWallet: TRADER } });
    expect(ix.keys.some((k) => k.isSigner)).toBe(false);
  });
});

describe("the dust floor", () => {
  /**
   * "pool 1 SOL minimum ~0.000287 SOL (bisected: 287,167 accepted)". Our model
   * is not bit-exact, and `minimumSpendLamports` is biased DOWN on purpose, so
   * the requirement is that it never quotes a minimum the program would refuse
   * as too HIGH - telling somebody a trade is impossible when it is not.
   */
  it("never quotes a minimum above the amount the program accepted at a 1 SOL pool", () => {
    const quoted = minimumSpendLamports(SOL);
    expect(quoted).toBeLessThanOrEqual(287_167);
    // ...and not uselessly low: within a thousand lamports of the real edge.
    expect(quoted).toBeGreaterThan(286_167);
  });

  // "It rises with the pool."
  it("rises with the pool", () => {
    expect(minimumSpendLamports(20 * SOL)).toBeGreaterThan(minimumSpendLamports(SOL));
    expect(minimumSpendLamports(SOL)).toBeGreaterThan(minimumSpendLamports(0));
  });
});
