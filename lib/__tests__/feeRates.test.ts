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

// Stated as three separate facts rather than one derived number, deliberately.
//
// The fee and the artist's share of it are different quantities, and every
// mis-statement of this that has actually happened collapsed them: "the trade
// fee is 1.005%" instead of "the trade fee is 1.500%, of which the artist takes
// 67%, so 1.005% of a trade reaches the artist". A test asserting only the
// resulting 1.005% passes while that sentence is wrong, which is the whole
// problem - so the primitives are the constants and the rate is derived.
const TOTAL_TRADE_FEE = 0.015; // measured, exact lamports, 14 trades / 7 battles
const ARTIST_SPLIT = 0.67; // measured, artist's share OF the fee
const PLATFORM_SPLIT = 0.33;

const ARTIST_TRADE_RATE = TOTAL_TRADE_FEE * ARTIST_SPLIT;
const PLATFORM_TRADE_RATE = TOTAL_TRADE_FEE * PLATFORM_SPLIT;

describe("the measured fee split", () => {
  it("is 1.500% total, and the two legs sum to it exactly", () => {
    expect(ARTIST_TRADE_RATE + PLATFORM_TRADE_RATE).toBeCloseTo(TOTAL_TRADE_FEE, 10);
  });

  it("keeps the fee and the artist's share of it as distinct quantities", () => {
    // The compression that has actually happened, twice: quoting 1.005% as the
    // fee. It is 67% of the fee. If these two are ever equal, someone has
    // flattened a two-step statement into a one-step one.
    expect(ARTIST_TRADE_RATE).not.toBeCloseTo(TOTAL_TRADE_FEE, 6);
    expect(ARTIST_TRADE_RATE).toBeCloseTo(0.01005, 10);
    expect(PLATFORM_TRADE_RATE).toBeCloseTo(0.00495, 10);
  });

  it("pays the artist twice what the platform takes on the same trade", () => {
    expect(ARTIST_TRADE_RATE / PLATFORM_TRADE_RATE).toBeCloseTo(67 / 33, 6);
    expect(ARTIST_TRADE_RATE).toBeGreaterThan(2 * PLATFORM_TRADE_RATE - 1e-9);
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

describe("published copy never states the artist share bare", () => {
  // A rate with no leg attached is what the next person compresses. Anywhere
  // 1.005% appears in copy, the sentence around it must say whose share it is,
  // so that quoting the sentence cannot produce "the trade fee is 1.005%".
  const SURFACES = ["app/case-study/page.tsx", "lib/embeds.ts"];

  it("attaches the share to its leg wherever the number appears", () => {
    let found = 0;
    for (const rel of SURFACES) {
      const text = read(rel);
      let from = 0;
      for (;;) {
        const at = text.indexOf("1.005%", from);
        if (at === -1) break;
        found += 1;
        const around = text.slice(Math.max(0, at - 240), at + 240);
        expect(
          /artist/i.test(around) && /(of every trade|share|split|1\.500%)/i.test(around),
        ).toBe(true);
        from = at + 1;
      }
    }
    // Without this the loop passes by finding nothing, which is the same trap
    // docs/AUDIT.md records as "a gate nobody invokes is not a gate".
    expect(found).toBeGreaterThanOrEqual(SURFACES.length);
  });

  it("never calls 1.005% the trade fee", () => {
    for (const rel of SURFACES) {
      const text = read(rel).toLowerCase();
      expect(text).not.toContain("trade fee is 1.005");
      expect(text).not.toContain("1.005% fee");
      expect(text).not.toContain("fee of 1.005");
    }
  });
});

describe("the superseded rate does not survive anywhere in copy", () => {
  // Added after the tests above passed while three surfaces still said "1% of
  // every trade" - including one inside the FAQ schema. Guarding the correct
  // number from being compressed does nothing about the wrong number still
  // sitting there, and only one of those two had a test.
  const SURFACES = ["app/case-study/page.tsx", "lib/embeds.ts", "app/layout.tsx"];
  const SUPERSEDED = [
    "1% of every trade",
    "1% per trade",
    "1 percent of every trade",
    "1 percent of trading volume",
    "0.5% to the platform",
  ];

  it("never states the artist rate as the documented 1%", () => {
    for (const rel of SURFACES) {
      const text = read(rel).toLowerCase();
      for (const phrase of SUPERSEDED) {
        expect({ rel, phrase, found: text.includes(phrase) }).toEqual({
          rel, phrase, found: false,
        });
      }
    }
  });
});

describe("citable facts carry the date they were measured on", () => {
  // Convention 20: a published figure names its legs and its measurement date.
  // This block is literally called CITABLE_FACTS, so it is the one place where
  // a figure without a date is most likely to be quoted onward.
  it("dates every WaveWarZ figure in the citable-facts block", () => {
    const page = read("app/case-study/page.tsx");
    const block = page.slice(
      page.indexOf("const CITABLE_FACTS"),
      page.indexOf("export default function"),
    );
    expect(block.length).toBeGreaterThan(200);
    for (const row of ["WaveWarZ battles", "cumulative trading volume", "artist payouts"]) {
      const at = block.indexOf(row);
      expect(at).toBeGreaterThan(-1);
      const line = block.slice(Math.max(0, at - 200), at + 240);
      expect(/\d{1,2} Sep 2026|September 2026/.test(line)).toBe(true);
    }
  });

  it("no longer carries the superseded battle or volume totals", () => {
    const page = read("app/case-study/page.tsx");
    expect(page).not.toContain("1,291+");
    expect(page).not.toContain("878+ SOL");
    expect(page).not.toContain("13.39 SOL");
  });
});
