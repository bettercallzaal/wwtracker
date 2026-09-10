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
  it("corrects at the READ, through the shared module, before anything is derived", () => {
    // This used to require the inline swap `sells: d.claims, claims: d.sells`
    // in ww-gen.mjs. On 2026-09-10 the swap moved into lib/onchainCorrect.mjs,
    // shared with the browser read, so the build and the read cannot carry two
    // copies that drift. The test pins the placement: every derived object must
    // be built after the corrected read.
    const gen = readFileSync(`${root}scripts/ww-gen.mjs`, "utf8");
    const readAt = gen.indexOf("const onchain = correctDays(onchainRaw");
    expect(readAt).toBeGreaterThan(-1);
    for (const derived of ["const active =", "const timeline =", "const program = {"]) {
      expect({ derived, afterRead: gen.indexOf(derived) > readAt }).toEqual({
        derived, afterRead: true,
      });
    }
    expect(gen).toContain("TRANSPOSED");
  });

  it("carries the corrected trade count into the timeline, not just the totals", () => {
    // buys + sells = 11,968. buys + claims shipped once as 13,055, and
    // failed attempts included shipped as 12,408.
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

  it("matches the chain scan exactly on every leg", () => {
    // Was "within 4%", with a buys residual recorded as still open. The residual
    // was failed transactions - 3.7%, just inside the tolerance that hid it.
    // Since 2026-09-10 these three columns come from the chain scan itself, so
    // the only right answer is exact. Claims are 3,388 here, not the 3,390 in
    // CHAIN below: the Dune file stops at 2026-09-05 and two claims landed on
    // the 6th.
    expect({ buys: WW.program.buys, sells: WW.program.sells, claims: WW.program.claims })
      .toEqual({ buys: CHAIN.buys, sells: CHAIN.sells, claims: 3388 });
  });
});
