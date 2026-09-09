import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WW } from "@/lib/wwData";

// public/ww-onchain-daily.json has `sells` and `claims` transposed.
//
// Measured 2026-09-08 against a complete chain scan of all 1,643 battles, day by
// day across the 330 days both cover:
//
//   dune.sells == chain.claims AND dune.claims == chain.sells   259 days (78%)
//   dune.sells == chain.sells  (the straight reading)            22 days (7%)
//   sells + claims TOTAL agrees                                 259 days
//
// The pair total agreeing on exactly the days the swap holds is what makes it a
// relabel and not missing data: the decoder sees every instruction and files two
// of them under each other's name.
//
// It shipped. AboutWaveWarZ rendered "CLAIMS 2,762 / winnings withdrawn" when
// 2,762 is the sell count, and BattleLifecycle's buysPerSell was built on it.
//
// scripts/ww-gen.mjs swaps them back at the boundary. These tests pin that,
// because the obvious "fix" for somebody who has not read AUDIT 3.8 is to
// straighten the mapping and reintroduce the bug.

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Chain scan totals, 1,643 battles, committed at data/chain-snapshot-2026-09-06. */
const CHAIN = { buys: 9297, sells: 2671, claims: 3390 };

describe("the sell/claim transposition stays corrected", () => {
  it("swaps at the READ, not inside one derived object", () => {
    // This assertion used to require the cross-mapping `sells: sum(d => d.claims)`
    // inside the `program` object, and passed while the bug was still live:
    // `timeline` is built ABOVE that line from the raw rows, so WW.timeline
    // shipped buys + CLAIMS as its trade count and OnChainProof rendered
    // "Trades 13,055" for a figure that is 12,408.
    //
    // A correction applied to one of the two objects a script emits is not a
    // correction, so the test now pins the placement rather than the mapping.
    const gen = readFileSync(`${root}scripts/ww-gen.mjs`, "utf8");
    const readAt = gen.indexOf("onchainRaw.map");
    expect(readAt).toBeGreaterThan(-1);
    expect(gen).toMatch(/sells:\s*d\.claims,\s*claims:\s*d\.sells/);
    // Everything derived must come after the swap.
    for (const derived of ["const active =", "const timeline =", "const program = {"]) {
      expect({ derived, afterSwap: gen.indexOf(derived) > readAt }).toEqual({
        derived, afterSwap: true,
      });
    }
    expect(gen).toContain("TRANSPOSED");
  });

  it("carries the corrected trade count into the timeline, not just the totals", () => {
    // buys + sells = 12,408. buys + claims = 13,055, which is what shipped.
    const trades = WW.timeline.reduce((a, d) => a + d.trades, 0);
    expect(trades).toBe(WW.program.buys + WW.program.sells);
    expect(trades).not.toBe(WW.program.buys + WW.program.claims);
  });

  it("reports more claims than sells, which is what chain says", () => {
    // Every settled position is claimed; only some are sold early. Claims
    // exceeding sells is the shape, and the transposed data inverted it.
    expect(WW.program.claims).toBeGreaterThan(WW.program.sells);
    expect(CHAIN.claims).toBeGreaterThan(CHAIN.sells);
  });

  it("lands within 4% of the chain scan on every leg", () => {
    // Not exact - there is a residual on buys that is not the transposition and
    // is recorded as still open. But a leg being 27% out was the transposition,
    // and it is gone.
    for (const k of ["buys", "sells", "claims"] as const) {
      const drift = Math.abs(WW.program[k] - CHAIN[k]) / CHAIN[k];
      expect({ leg: k, within4pc: drift < 0.04, drift: +(drift * 100).toFixed(1) })
        .toEqual({ leg: k, within4pc: true, drift: +(drift * 100).toFixed(1) });
    }
  });
});
