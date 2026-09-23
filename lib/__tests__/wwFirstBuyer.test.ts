/**
 * A 66-second arrival floor has two explanations that the timing alone cannot
 * separate: a room reacting together, or one wallet on a timer. These are the
 * cases that separate them, plus the ways a concentration count lies.
 */
import { describe, expect, it } from "vitest";
import {
  describeFirstBuyers,
  firstBuyerConcentration,
  shortAddress,
  type FirstBuyerRow,
} from "../ww/firstBuyer";

const row = (battleId: number, trader: string, gap: number | null = 50): FirstBuyerRow => ({
  battleId,
  trader,
  gapFromTradeableSeconds: gap,
});

describe("it separates one actor from a market", () => {
  it("says so plainly when a single wallet is first every time", () => {
    const c = firstBuyerConcentration([row(1, "W"), row(2, "W"), row(3, "W")]);
    expect(c.distinctTraders).toBe(1);
    expect(c.topTraderBattles).toBe(3);
    const lines = describeFirstBuyers(c).join("\n");
    expect(lines).toMatch(/ONE WALLET is first every time/);
    expect(lines).toMatch(/not the room's/);
  });

  it("says so when one wallet takes more than half", () => {
    const c = firstBuyerConcentration([row(1, "W"), row(2, "W"), row(3, "W"), row(4, "X"), row(5, "Y")]);
    const lines = describeFirstBuyers(c).join("\n");
    expect(lines).toMatch(/first in more than half/);
    expect(lines).toMatch(/would be quoting one participant/);
  });

  it("refuses to upgrade a spread-out result into proof the room heard anything", () => {
    const c = firstBuyerConcentration([row(1, "W"), row(2, "X"), row(3, "Y"), row(4, "Z")]);
    const lines = describeFirstBuyers(c).join("\n");
    expect(lines).toMatch(/NO SINGLE WALLET dominates/);
    // The limit, stated in the output rather than left to the reader.
    expect(lines).toMatch(/Watching the chain produces the same rows/);
  });

  it("is exactly at half, which is not more than half", () => {
    const c = firstBuyerConcentration([row(1, "W"), row(2, "W"), row(3, "X"), row(4, "Y")]);
    expect(c.topTraderBattles).toBe(2);
    expect(describeFirstBuyers(c).join("\n")).toMatch(/NO SINGLE WALLET dominates/);
  });
});

describe("an unknown arrival is not a fast one", () => {
  it("keeps fastest null rather than letting a null behave as zero", () => {
    const c = firstBuyerConcentration([row(1, "W", null), row(2, "W", null)]);
    expect(c.tallies[0].fastestSeconds).toBeNull();
    expect(describeFirstBuyers(c).join("\n")).toMatch(/fastest UNKNOWN/);
  });

  it("uses only the known gaps when a wallet has both", () => {
    const c = firstBuyerConcentration([row(1, "W", null), row(2, "W", 40), row(3, "W", 90)]);
    expect(c.tallies[0].fastestSeconds).toBe(40);
  });
});

describe("nothing measured reports as nothing measured", () => {
  it("does not print a concentration for an empty sample", () => {
    const lines = describeFirstBuyers(firstBuyerConcentration([])).join("\n");
    expect(lines).toMatch(/NO FIRST BUYERS READ/);
    expect(lines).not.toMatch(/distinct wallets/);
  });
});

describe("counts carry their denominator", () => {
  it("prints the share as a count of a total, never a bare percentage", () => {
    const lines = describeFirstBuyers(
      firstBuyerConcentration([row(1, "W"), row(2, "W"), row(3, "X")]),
    ).join("\n");
    expect(lines).toMatch(/2 distinct wallets made the first trade across 3 battles/);
    expect(lines).toMatch(/the most frequent took 2 of 3/);
    expect(lines).not.toMatch(/%/);
  });
});

describe("shortAddress", () => {
  it("shortens a real-length address and leaves a short one alone", () => {
    expect(shortAddress("4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk")).toBe("4aY1..W1Bk");
    expect(shortAddress("short")).toBe("short");
  });
});

/**
 * The house is not a trader. Over the 60 most recent battles the most frequent
 * first buyer was the platform treasury, 20 of 56 - and `lib/config.ts` has
 * warned since 2026-09-06 that it creates battles as well as trading them.
 * The first version of this module counted it as a trader, so its verdict was
 * partly a statement about the house.
 */
describe("the platform's own wallet is separated from traders", () => {
  const HOUSE = new Set(["TREASURY"]);

  it("names the house count and keeps it out of the trader tallies", () => {
    const c = firstBuyerConcentration(
      [row(1, "TREASURY"), row(2, "TREASURY"), row(3, "W"), row(4, "X")],
      HOUSE,
    );
    expect(c.measured).toBe(4);
    expect(c.houseBattles).toBe(2);
    expect(c.excludingHouse).not.toBeNull();
    expect(c.excludingHouse?.measured).toBe(2);
    expect(c.excludingHouse?.distinctTraders).toBe(2);
    expect(c.excludingHouse?.tallies.map((t) => t.trader)).not.toContain("TREASURY");

    const lines = describeFirstBuyers(c).join("\n");
    expect(lines).toMatch(/THE PLATFORM'S OWN WALLET made the first trade in 2 of 4 battles/);
    expect(lines).toMatch(/house excluded/);
  });

  it("changes the verdict when the house was the one dominating", () => {
    const rows = [row(1, "TREASURY"), row(2, "TREASURY"), row(3, "TREASURY"), row(4, "W"), row(5, "X")];
    // Counted as a trader, the treasury takes 3 of 5 and the verdict is "one
    // wallet dominates". That sentence would be about the house.
    expect(describeFirstBuyers(firstBuyerConcentration(rows)).join("\n")).toMatch(
      /first in more than half/,
    );
    expect(describeFirstBuyers(firstBuyerConcentration(rows, HOUSE)).join("\n")).toMatch(
      /NO SINGLE WALLET dominates/,
    );
  });

  it("says when no house wallets were named, rather than implying none traded", () => {
    const c = firstBuyerConcentration([row(1, "W")]);
    expect(c.excludingHouse).toBeNull();
    expect(describeFirstBuyers(c).join("\n")).toMatch(/NO HOUSE WALLETS NAMED/);
  });

  it("reports a house that never went first as zero, not as absent", () => {
    const c = firstBuyerConcentration([row(1, "W"), row(2, "X")], HOUSE);
    expect(c.houseBattles).toBe(0);
    expect(describeFirstBuyers(c).join("\n")).toMatch(/made no first trade in these 2 battles/);
  });

  it("refuses to report trader concentration when only the house was ever first", () => {
    const c = firstBuyerConcentration([row(1, "TREASURY"), row(2, "TREASURY")], HOUSE);
    const lines = describeFirstBuyers(c).join("\n");
    expect(lines).toMatch(/NO OUTSIDE TRADER was ever first/);
    expect(lines).not.toMatch(/dominates/);
  });
});
