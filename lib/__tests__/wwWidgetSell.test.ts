/**
 * The sell side of the widget, as pure functions.
 *
 * The widget was buy-only through the 2026-09-20 finals. Every lesson that
 * night taught about selling - the curve pays about twice what a claim pays,
 * a sell with no floor takes whatever lands, the pool can move 6x in the last
 * second - was unactionable on our own UI. Zaal ruled on 2026-09-21: build it
 * today, tests first (decisions/grill-2026-09-21-wwtracker-morning-4.md).
 *
 * WHY THESE ARE MODULE FUNCTIONS AND NOT COMPONENT LOGIC. vitest runs in node
 * here, with no DOM, and the component cannot be rendered. So everything the
 * component decides - is this sell sized right, what does it pay, what share
 * of the side is that, what does the RPC balance read mean - lives in
 * `lib/ww/widgetSell.ts` where it is reachable, and the component only wires it.
 */
import { describe, expect, it } from "vitest";
import { parseTokenAccountBalance, sellEstimate, shareOfSide } from "../ww/widgetSell";
import { quoteSell, supplyAtPool } from "../ww/quote";

const POOL = 5_000_000_000;
const CURVE_SUPPLY = supplyAtPool(POOL);
// A real battle's minted supply sits BELOW the curve's, because each trade
// floors to a whole step. 0.4% under is in the measured range.
const MINTED = Math.floor(CURVE_SUPPLY * 0.996);

describe("sellEstimate", () => {
  it("refuses an empty or zero amount with a reason a person can act on", () => {
    const r = sellEstimate({ poolLamports: POOL, mintedSupply: MINTED, sellTokens: 0, balanceTokens: 1_000_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/amount/i);
  });

  it("refuses more than the wallet holds, and says how much it holds", () => {
    const r = sellEstimate({ poolLamports: POOL, mintedSupply: MINTED, sellTokens: 2_000_000, balanceTokens: 1_000_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/1,000,000/);
  });

  it("quotes off the MINTED supply, not the curve's, so it agrees with quoteSell given the account", () => {
    const tokens = 1_000_000;
    const r = sellEstimate({ poolLamports: POOL, mintedSupply: MINTED, sellTokens: tokens, balanceTokens: tokens });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const q = quoteSell(POOL, tokens, MINTED);
      expect(r.quote.lamportsOut).toBe(q.lamportsOut);
      // And NOT the curve-supply figure, which overstates proceeds on a traded
      // battle. The two differ, so this is a real check rather than a tautology.
      expect(r.quote.lamportsOut).not.toBe(quoteSell(POOL, tokens).lamportsOut);
    }
  });

  it("falls back to the curve when no supply is known, and says so", () => {
    const tokens = 1_000_000;
    const r = sellEstimate({ poolLamports: POOL, mintedSupply: null, sellTokens: tokens, balanceTokens: tokens });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.supplySource).toBe("curve");
      expect(r.quote.lamportsOut).toBe(quoteSell(POOL, tokens).lamportsOut);
    }
  });

  it("reports the share of the side the sale represents", () => {
    const tokens = Math.floor(MINTED / 4);
    const r = sellEstimate({ poolLamports: POOL, mintedSupply: MINTED, sellTokens: tokens, balanceTokens: tokens });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.shareOfSide).toBeCloseTo(0.25, 6);
  });

  it("refuses a sell the curve cannot price rather than throwing into the UI", () => {
    // More than the whole side: quoteSell throws; the estimate must refuse.
    const r = sellEstimate({ poolLamports: POOL, mintedSupply: MINTED, sellTokens: MINTED + 1, balanceTokens: MINTED + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/supply/i);
  });
});

describe("shareOfSide", () => {
  it("is balance over minted supply", () => {
    expect(shareOfSide(250, 1000)).toBeCloseTo(0.25, 9);
  });
  it("is 0 when the side has no supply, not NaN", () => {
    expect(shareOfSide(0, 0)).toBe(0);
  });
});

/**
 * `getTokenAccountBalance` on an associated token account that was never
 * created is an RPC ERROR ("could not find account"), not a zero. A wallet that
 * has never traded this battle must read as holding 0, and a wallet whose read
 * failed for any other reason must NOT.
 */
describe("parseTokenAccountBalance", () => {
  it("reads base units as a number from the RPC shape", () => {
    expect(parseTokenAccountBalance({ result: { value: { amount: "1234500000", decimals: 6 } } })).toEqual({
      amount: 1_234_500_000,
      exists: true,
    });
  });

  it("treats a missing account as a balance of zero that does not exist", () => {
    expect(
      parseTokenAccountBalance({ error: { code: -32602, message: "Invalid param: could not find account" } }),
    ).toEqual({ amount: 0, exists: false });
  });

  it("throws on any other RPC error rather than reporting zero", () => {
    expect(() => parseTokenAccountBalance({ error: { code: -32005, message: "Node is behind" } })).toThrow(/behind/);
  });

  it("throws on a shape it does not recognise", () => {
    expect(() => parseTokenAccountBalance({ result: {} })).toThrow();
  });
});
