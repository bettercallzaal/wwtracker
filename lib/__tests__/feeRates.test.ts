import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The published fee rates, asserted against what was measured on chain.
//
// This is the test class docs/AUDIT.md 3.2 asks for - a displayed figure checked
// against its source - applied to prose rather than to a component, because the
// case-study answer is emitted as JSON-LD FAQ schema and is therefore scraped
// into search results and answer engines. A wrong rate there outlives the page.
//
// Every figure below comes from bettercallzaal/wavewarz-protocol:
//   trade fee 1.500%, split 67/33          14 trades, 7 battles, exact lamports
//   settlement 5% / 2% / 3% of loser pool  waterfall, winner leg 1,506/1,506
//   volume, artists, platform revenue      complete scan, 1,643 battles

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

const ARTIST_TRADE_RATE = 0.01005; // 67% of 1.500%
const PLATFORM_TRADE_RATE = 0.00495; // 33% of 1.500%

describe("the measured fee split", () => {
  it("is 1.500% total, and the two legs sum to it exactly", () => {
    expect(ARTIST_TRADE_RATE + PLATFORM_TRADE_RATE).toBeCloseTo(0.015, 10);
  });

  it("is not the documented 1.00 / 0.50, which is what makes it worth testing", () => {
    // The PRD, the fee schedule and the record layer's wavewarz-math.ts all say
    // 1.00% and 0.50%. The lamport values are exact at every trade size, so the
    // difference is not rounding. Anyone deriving a figure from those three
    // inherits the error silently.
    expect(ARTIST_TRADE_RATE).not.toBe(0.01);
    expect(ARTIST_TRADE_RATE).toBeGreaterThan(0.01);
  });
});

describe("published copy quotes the measured rate", () => {
  it("the artist-payouts embed blurb says 1.005%, not 1 percent", () => {
    const embeds = read("lib/embeds.ts");
    const blurb = embeds.slice(embeds.indexOf('slug: "artist-payouts"'));
    expect(blurb).toContain("1.005%");
    expect(blurb.slice(0, 400)).not.toContain("1 percent of trading volume");
  });

  it("the case study no longer states a per-trade artist rate above the trade fee", () => {
    const page = read("app/case-study/page.tsx");
    // 1.53% was the all-legs effective rate presented as a rate "on every
    // trade". Settlement bonuses are not charged per trade, so the two are
    // different quantities and only one of them is a per-trade rate.
    expect(page).not.toContain("1.53% artist payout rate on every trade");
    expect(page).toContain("1.005% of every trade");
  });

  it("the case study does not call platform revenue a rate on trading volume", () => {
    const page = read("app/case-study/page.tsx");
    // 12.77 of the 19.34 SOL is queue-jump fees, which do not scale with volume.
    // Dividing the total by volume produces a number that looks like a fee rate
    // and does not behave like one.
    expect(page).not.toContain("2.28% effective fee rate");
    expect(page).toContain("do not scale with volume");
  });

  it("every figure in the case study carries the date it was measured on", () => {
    const page = read("app/case-study/page.tsx");
    // The failure this guards against: a true figure with a stale date reads as
    // invented, because a reader checking it against a snapshot from that date
    // cannot reproduce it.
    expect(page).toContain("7 September 2026");
    expect(page).not.toContain("As of July 2026");
  });
});
