/**
 * Zero to a traded, two-sided battle, in one transaction, against the deployed
 * program.
 *
 * Everything else in this suite tests a piece. This tests that the pieces
 * compose: launch, mints, the trader's two token accounts, a buy on each side,
 * and a sell - eight instructions, built entirely from the exported surface,
 * simulated on mainnet with `sigVerify: false`. Nothing was signed or sent.
 *
 * **It is here because "the SDK can build every instruction" is not the same
 * claim as "the SDK can run the protocol", and only one of them is what a front
 * end needs.** The gap between those two claims is where `initializeMints` hid:
 * every instruction the library knew about worked, and a battle built from them
 * could not be traded.
 *
 * THE LOGS ARE THE INDEPENDENT WITNESS. The program prints its own fee
 * breakdown, and it agrees with `feeSplit` to the lamport without ever having
 * been asked. That is a second source for the fee model, arrived at by the
 * program rather than by our replay of its transactions.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-lifecycle-simulation.json";
import { ARTIST_FEE_BPS, ARTIST_FEE_SHARE, PLATFORM_FEE_BPS, TRADE_FEE, feeSplit, quoteBuy, quoteSell } from "../ww/quote";

type Fx = {
  err: unknown; unitsConsumed: number; instructionCount: number; logs: string[];
  buyALamports: number; buyBLamports: number; soldATokens: number;
  battleAccount: string; traderTokensA: string; traderTokensB: string;
  vaultLamports: number; mintABytes: number; mintBBytes: number;
};
const f = fixture as unknown as Fx;
const raw = Buffer.from(f.battleAccount, "base64");
const num = (re: RegExp) => Number(f.logs.find((l) => re.test(l))!.match(/(\d+)/)![1]);

describe("the whole thing, in one transaction", () => {
  it("runs to completion with no error", () => {
    expect(f.err).toBeNull();
    expect(f.instructionCount).toBe(8);
  });

  it("fits comfortably inside one transaction's compute budget", () => {
    // 202,638 of 1,400,000. A front end can do this in a single user approval.
    expect(f.unitsConsumed).toBeLessThan(1_400_000);
  });

  it("walks every stage, in order, in the program's own words", () => {
    const stages = f.logs.filter((l) => l.startsWith("Program log: Instruction: "))
      .map((l) => l.replace("Program log: Instruction: ", ""));
    expect(stages).toEqual(["InitializeBattle", "InitializeMints", "BuyShares", "BuyShares", "SellShares"]);
  });

  it("leaves a real battle account with both sides funded and unsettled", () => {
    expect(raw).toHaveLength(353);
    expect(raw[245]).toBe(0); // not settled: it is still running
    expect(Number(raw.readBigUInt64LE(212))).toBeGreaterThan(0);
    expect(Number(raw.readBigUInt64LE(220))).toBeGreaterThan(0);
  });

  it("creates two real SPL mints, which is the step that was missing", () => {
    expect(f.mintABytes).toBe(82);
    expect(f.mintBBytes).toBe(82);
  });

  it("leaves the trader holding both sides, matching the account's supply", () => {
    expect(f.traderTokensA).toBe(String(raw.readBigUInt64LE(196)));
    expect(f.traderTokensB).toBe(String(raw.readBigUInt64LE(204)));
  });
});

describe("the quotes agree with what the program did", () => {
  it("predicted the A-side mint exactly", () => {
    expect(quoteBuy(0, f.buyALamports).tokensOut).toBe(num(/Calculated (\d+) tokens to mint/));
  });

  it("predicted the B-side mint exactly", () => {
    const b = f.logs.filter((l) => /Calculated \d+ tokens to mint/.test(l))[1];
    expect(quoteBuy(0, f.buyBLamports).tokensOut).toBe(Number(b.match(/(\d+)/)![1]));
  });

  it("predicted the seller's NET proceeds exactly, which is the number a seller sees", () => {
    // The pool the sell priced against, and the supply it burned from.
    const poolBeforeSell = Math.round(f.buyALamports * (1 - TRADE_FEE));
    const supplyBeforeSell = quoteBuy(0, f.buyALamports).tokensOut;
    const q = quoteSell(poolBeforeSell, f.soldATokens, supplyBeforeSell);
    expect(Math.round(q.lamportsOut)).toBe(num(/SOL to return: (\d+)/));
  });
});

/**
 * The fee model, confirmed by the program rather than by our reading of it.
 */
describe("the program prints its own fee breakdown, and it matches", () => {
  const total = num(/Total fee: (\d+)/);
  const platform = num(/WaveWarZ fee: (\d+)/);
  const artist = num(/Artist fee: (\d+)/);

  it("takes exactly 1.5% of the buy", () => {
    expect(total).toBe(f.buyALamports * TRADE_FEE);
  });

  it("splits it 67/33 to the artist, not the platform", () => {
    // The direction is the point: the artist gets twice what the platform does.
    expect(artist).toBe(Math.floor((total * ARTIST_FEE_BPS) / 10_000));
    expect(platform).toBe(Math.floor((total * PLATFORM_FEE_BPS) / 10_000));
    // And NOT from the float share, which shorts the platform by a lamport here.
    expect(Math.floor(total * (1 - ARTIST_FEE_SHARE))).toBe(platform - 1);
    expect(artist).toBeGreaterThan(platform);
  });

  it("floors both halves, so a fee can keep a lamport back", () => {
    // From the SELL in the same transaction: 61,063 + 30,076 = 91,139 of
    // 91,140. The crumb stays in the vault. A reconciliation assuming the
    // halves sum is off by a lamport a trade.
    // Index 2: the two buys print first, the sell third. Index 1 is the second
    // BUY, whose fee happens to divide cleanly and shows no crumb at all.
    const at = (re: RegExp, i: number) =>
      Number(f.logs.filter((l) => re.test(l))[i].match(/(\d+)/)![1]);
    const sellTotal = at(/Total fee: \d+/, 2);
    const sellArtist = at(/Artist fee: \d+/, 2);
    const sellPlatform = at(/WaveWarZ fee: \d+/, 2);
    const ours = feeSplit(sellTotal);
    expect(ours.artistLamports).toBe(sellArtist);
    expect(ours.platformLamports).toBe(sellPlatform);
    expect(sellArtist + sellPlatform).toBeLessThan(sellTotal);
    expect(sellTotal - sellArtist - sellPlatform).toBe(1);
  });

  it("agrees with feeSplit to the lamport", () => {
    const ours = feeSplit(total);
    expect(ours.artistLamports).toBe(artist);
    expect(ours.platformLamports).toBe(platform);
  });

  it("puts the rest into the pool, so nothing is unaccounted for", () => {
    expect(num(/SOL for tokens: (\d+)/) + total).toBe(f.buyALamports);
  });
});
