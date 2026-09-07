import { describe, it, expect } from "vitest";
import {
  TRADER_TABLE_HEAD,
  TRADER_PNL_NOTE,
  TRADER_PNL_WITHDRAWN,
  TRADER_PNL_MEASUREMENT,
} from "@/lib/traderLeaderboard";

// The bugs that actually shipped in this repo were displayed figures that
// disagreed with their source, not type errors (docs/AUDIT.md 3.2). This is that
// class of test: it asserts the widget cannot re-acquire a column we measured to
// be wrong without somebody deleting a test that says why.

describe("the top-traders table", () => {
  it("does not render a P&L column while the upstream figure is disputed", () => {
    expect(TRADER_PNL_WITHDRAWN).toBe(true);
    const head = TRADER_TABLE_HEAD.map((h) => h.toLowerCase());
    expect(head.some((h) => h.includes("p&l") || h.includes("pnl"))).toBe(false);
    expect(head.some((h) => h.includes("profit"))).toBe(false);
  });

  it("carries a caveat inside the frame, because a screenshot leaves our docs behind", () => {
    expect(TRADER_PNL_NOTE).toContain("withdrawn");
    // The remaining columns come from the same short rows, so the note has to
    // say so rather than implying only P&L was affected.
    expect(TRADER_PNL_NOTE.toLowerCase()).toContain("volume");
    expect(TRADER_PNL_NOTE.toLowerCase()).toContain("win rate");
    // It renders in a 9.5px mono line on somebody else's page.
    expect(TRADER_PNL_NOTE.length).toBeLessThan(220);
  });

  it("keeps the columns that are still worth showing", () => {
    expect([...TRADER_TABLE_HEAD]).toEqual(["#", "Wallet", "Volume", "Win %"]);
  });
});

describe("the measurement that withdrew the column", () => {
  it("records both aggregates, and they disagree in the direction that matters", () => {
    const { siteAggregateSol, chainAggregateSol } = TRADER_PNL_MEASUREMENT;
    // The site shows profit. Traders in aggregate must be down by roughly the
    // fees taken out of them, which is what a fee is.
    expect(siteAggregateSol).toBeGreaterThan(0);
    expect(chainAggregateSol).toBeLessThan(0);
    expect(siteAggregateSol - chainAggregateSol).toBeGreaterThan(200);
  });

  it("keeps the note's headline count in step with the measurement", () => {
    const { shownInProfitButDown, siteWallets } = TRADER_PNL_MEASUREMENT;
    expect(TRADER_PNL_NOTE).toContain(String(shownInProfitButDown));
    expect(TRADER_PNL_NOTE).toContain(String(siteWallets));
    expect(shownInProfitButDown).toBeLessThan(siteWallets);
  });

  it("has one wallet carrying most of the gap, which is the reason to act now", () => {
    const { largestWalletDeltaSol, siteAggregateSol, chainAggregateSol } =
      TRADER_PNL_MEASUREMENT;
    const gap = siteAggregateSol - chainAggregateSol;
    expect(largestWalletDeltaSol / gap).toBeGreaterThan(0.6);
  });
});
