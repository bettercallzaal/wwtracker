/**
 * Pool history rebuilt from a battle's own transactions, without the curve.
 *
 * Every number here is read off real transactions on battle 1789948124
 * (ww-pool-backfill-transactions.json): the program's own lines give the pool
 * delta (the vault moves one lamport less on a sell whose fee split floors),
 * the mint's token delta is the supply delta, and the log line names the side. The tests pin that the reader takes those numbers and
 * refuses everything that is not a successful trade.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-pool-backfill-transactions.json";
import { endStateDiff, replayTrades, tradeFromTransaction, type TxLike } from "../ww/poolBackfill";

const ids = { vault: fixture.vault, mintA: fixture.mint_a, mintB: fixture.mint_b };
const tx = (k: keyof typeof fixture.transactions) => fixture.transactions[k] as unknown as TxLike & { signature: string };
const step = (k: keyof typeof fixture.transactions) => tradeFromTransaction(tx(k).signature, tx(k), ids);

describe("tradeFromTransaction", () => {
  it("reads a buy: pool up by the 'SOL for tokens' line, supply up by the tokens minted", () => {
    const s = step("BuyShares")!;
    const logs = tx("BuyShares").meta.logMessages!;
    const solForTokens = Number(logs.find((l) => l.includes("SOL for tokens"))!.match(/(\d+) lamports/)![1]);
    const minted = Number(logs.find((l) => l.includes("tokens to mint"))!.match(/Calculated (\d+)/)![1]);
    expect(s.kind).toBe("buy");
    expect(s.side).toBe("b");
    expect(s.poolDelta).toBe(solForTokens);
    expect(s.supplyDelta).toBe(minted);
    expect(s.t).toBe(tx("BuyShares").blockTime);
  });

  it("reads a sell: pool down by net plus TOTAL fee, one more than the vault moved, supply down by the shares sold", () => {
    const s = step("SellShares")!;
    const logs = tx("SellShares").meta.logMessages!;
    const net = Number(logs.find((l) => l.includes("SOL to return"))!.match(/(\d+) lamports/)![1]);
    const fee = Number(logs.find((l) => l.includes("Total fee"))!.match(/(\d+) lamports/)![1]);
    const shares = Number(logs.find((l) => l.startsWith("Program log: Selling"))!.match(/Selling (\d+) shares/)![1]);
    expect(s.kind).toBe("sell");
    expect(s.side).toBe("a");
    expect(s.poolDelta).toBe(-(net + fee));
    expect(s.supplyDelta).toBe(-shares);
    // The crumb: the vault kept one lamport of the floored fee split.
    const t = tx("SellShares");
    const vi = t.transaction.message.accountKeys.indexOf(fixture.vault);
    expect(t.meta.postBalances[vi] - t.meta.preBalances[vi]).toBe(s.poolDelta + 1);
  });

  it("skips a failed buy, which moved nothing", () => {
    expect(step("FailedBuy")).toBeNull();
  });

  it("skips EndBattle, InitializeBattle and InitializeMints, which are not trades", () => {
    expect(step("EndBattle")).toBeNull();
    expect(step("InitializeBattle")).toBeNull();
    expect(step("InitializeMints")).toBeNull();
  });

  it("refuses a trade whose log names the other side than the mint that moved", () => {
    const t = JSON.parse(JSON.stringify(tx("BuyShares"))) as TxLike;
    t.meta.logMessages = t.meta.logMessages!.map((l) => l.replace("for artist B", "for artist A"));
    expect(() => tradeFromTransaction("x", t, ids)).toThrow(/log says artist A/);
  });

  it("refuses a trade that does not touch the vault", () => {
    expect(() => tradeFromTransaction("x", tx("BuyShares"), { ...ids, vault: "So11111111111111111111111111111111111111112" })).toThrow(/vault/);
  });
});

describe("replayTrades and endStateDiff", () => {
  it("accumulates per side from zero, oldest slot first", () => {
    const buy = step("BuyShares")!;
    const sell = step("SellShares")!;
    const samples = replayTrades([buy, sell]);
    const first = buy.slot < sell.slot ? buy : sell;
    const second = first === buy ? sell : buy;
    expect(samples[0]).toEqual({
      t: first.t,
      a: first.side === "a" ? first.poolDelta : 0,
      b: first.side === "b" ? first.poolDelta : 0,
      sa: first.side === "a" ? first.supplyDelta : 0,
      sb: first.side === "b" ? first.supplyDelta : 0,
    });
    expect(samples[1].a).toBe((first.side === "a" ? first.poolDelta : 0) + (second.side === "a" ? second.poolDelta : 0));
    expect(samples[1].b).toBe((first.side === "b" ? first.poolDelta : 0) + (second.side === "b" ? second.poolDelta : 0));
  });

  it("names every field the replay misses, and nothing when it lands", () => {
    const acct = { a: 10, b: 20, sa: 1, sb: 2 };
    expect(endStateDiff([{ t: 1, a: 10, b: 20, sa: 1, sb: 2 }], acct)).toEqual([]);
    expect(endStateDiff([{ t: 1, a: 10, b: 21, sa: 1, sb: 2 }], acct)).toEqual([{ field: "b", replay: 21, account: 20 }]);
    expect(endStateDiff([], acct)).toHaveLength(4);
  });
});
