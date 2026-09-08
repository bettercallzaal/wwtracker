import { describe, it, expect } from "vitest";
import {
  TRADER_TABLE_HEAD,
  TRADER_PNL_NOTE,
  TRADER_PNL_WITHDRAWN,
  TRADER_PNL_MEASUREMENT,
  TRADER_PNL_HISTORY,
} from "@/lib/traderLeaderboard";

// The bugs that actually shipped in this repo were displayed figures that
// disagreed with their source, not type errors (docs/AUDIT.md 3.2). This is that
// class of test: it asserts the widget cannot re-acquire a column we measured to
// be wrong without somebody deleting a test that says why.

describe("the top-traders table", () => {
  it("shows P&L only while the measurement says it agrees with chain", () => {
    // The flag and the measurement must move together. Flipping the flag back
    // without re-measuring is exactly how the +204 figure would return, so the
    // test binds them rather than asserting either alone.
    const head = TRADER_TABLE_HEAD.map((h) => h.toLowerCase());
    const showsPnl = head.some((h) => h.includes("p&l") || h.includes("pnl"));
    expect(showsPnl).toBe(!TRADER_PNL_WITHDRAWN);
    if (showsPnl) {
      // The conditions under which showing it is defensible, all measured.
      expect(TRADER_PNL_MEASUREMENT.shownInProfitButDown).toBe(0);
      expect(TRADER_PNL_MEASUREMENT.siteWallets).toBe(TRADER_PNL_MEASUREMENT.chainWallets);
      expect(Math.abs(TRADER_PNL_MEASUREMENT.largestWalletDeltaSol)).toBeLessThan(1);
      // Both aggregates negative: traders are down by roughly the fees, which is
      // what a fee is. A positive site aggregate is the original defect.
      expect(TRADER_PNL_MEASUREMENT.siteAggregateSol).toBeLessThan(0);
    }
  });

  it("keeps the residual explained rather than merely small", () => {
    // 4.38 SOL of gap is fine BECAUSE it is unclaimed winnings, not because it
    // is a small number. If the explanation stops covering most of it, that is
    // a new finding rather than an acceptable drift.
    const gap = Math.abs(
      TRADER_PNL_MEASUREMENT.siteAggregateSol - TRADER_PNL_MEASUREMENT.chainAggregateSol,
    );
    expect(TRADER_PNL_MEASUREMENT.unclaimedExplainsSol / gap).toBeGreaterThan(0.8);
  });

  it("remembers what was wrong before, so it cannot ship twice", () => {
    expect(TRADER_PNL_HISTORY.siteAggregateWhenWithdrawn).toBeGreaterThan(200);
    expect(TRADER_PNL_HISTORY.shownInProfitButDownWhenWithdrawn).toBe(45);
    expect(TRADER_PNL_HISTORY.worstSingleWalletDeltaSol).toBeGreaterThan(200);
  });

  it("carries a dated caveat inside the frame, because a screenshot leaves our docs behind", () => {
    expect(TRADER_PNL_NOTE).toContain(TRADER_PNL_MEASUREMENT.measuredOn);
    // The note must say what the residual IS, not merely that one exists - the
    // reader of a screenshot has no other source.
    expect(TRADER_PNL_NOTE.toLowerCase()).toContain("unclaimed");
    // It renders in a 9.5px mono line on somebody else's page.
    expect(TRADER_PNL_NOTE.length).toBeLessThan(220);
  });

  it("keeps the columns that are still worth showing", () => {
    expect([...TRADER_TABLE_HEAD]).toEqual(["#", "Wallet", "Volume", "Win %", "Net P&L"]);
  });
});

describe("the measurement that restored the column", () => {
  it("has both aggregates negative and close", () => {
    const { siteAggregateSol, chainAggregateSol } = TRADER_PNL_MEASUREMENT;
    expect(siteAggregateSol).toBeLessThan(0);
    expect(chainAggregateSol).toBeLessThan(0);
    expect(Math.abs(siteAggregateSol - chainAggregateSol)).toBeLessThan(10);
  });

  it("keeps the note's headline count in step with the measurement", () => {
    const { shownInProfitButDown, siteWallets } = TRADER_PNL_MEASUREMENT;
    expect(TRADER_PNL_NOTE).toContain(String(shownInProfitButDown));
    expect(TRADER_PNL_NOTE).toContain(String(siteWallets));
    expect(shownInProfitButDown).toBeLessThan(siteWallets);
  });

  it("no longer has one wallet carrying the gap - that was the withdrawal case", () => {
    // When it was withdrawn, a single wallet was 213 of the 221 SOL error. Now
    // the largest is 0.70 of 4.38, which is what "spread thin" looks like.
    const gap = Math.abs(
      TRADER_PNL_MEASUREMENT.siteAggregateSol - TRADER_PNL_MEASUREMENT.chainAggregateSol,
    );
    expect(TRADER_PNL_MEASUREMENT.largestWalletDeltaSol / gap).toBeLessThan(0.25);
    expect(TRADER_PNL_HISTORY.worstSingleWalletDeltaSol / 221).toBeGreaterThan(0.9);
  });
});
