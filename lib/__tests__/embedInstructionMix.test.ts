import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The transposition correction had a hole, and this test is the patch.
//
// duneTransposition.test.ts pins the swap-back inside scripts/ww-gen.mjs, which
// protects lib/wwData.ts and everything drawn from it. The embed widget did not
// go through that boundary: InstructionMix aggregated public/ww-onchain-daily.json
// directly, so it published the RAW Dune numbers - sellShares 3,409 and
// claimShares 2,762, the two bars swapped - on whatever partner page had
// iframed it. Rendered and confirmed 2026-09-09 at /embed/instruction-mix.
//
// A correction applied at one consumer and not another is not a correction, and
// the second consumer is the one on somebody else's site. So the widget now
// reads the complete chain scan, and this pins BOTH halves: the file it reads,
// and the file it must not.
//
// Regenerate the input with, in the wavewarz-protocol checkout:
//   cd data/chain-snapshot-2026-09-06
//   python3 ../../tools/offline-run.py ../../tools/instruction-mix-from-chain.py \
//       > ../../../wwtracker/public/ww-instruction-mix.json

const root = fileURLToPath(new URL("../../", import.meta.url));
const widgets = readFileSync(`${root}components/embeds/Widgets.tsx`, "utf8");
const mix = JSON.parse(readFileSync(`${root}public/ww-instruction-mix.json`, "utf8"));

/** Chain scan totals, 1,643 battles, data/chain-snapshot-2026-09-06. */
const CHAIN = { buyShares: 9307, sellShares: 2673, claimShares: 3394, createBattle: 1643 };

describe("the instruction mix embed reads the chain scan, not Dune", () => {
  it("publishes the chain scan's own counts", () => {
    expect(mix.calls).toEqual(CHAIN);
  });

  it("carries the day it was measured through", () => {
    expect(mix.measuredThrough).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reports more claims than sells, which is the shape chain has", () => {
    // Every settled position is claimed; only some are sold early. The
    // transposed data inverted this, and the inversion is what shipped.
    expect(mix.calls.claimShares).toBeGreaterThan(mix.calls.sellShares);
  });

  it("does not let the widget read the transposed daily file back in", () => {
    const fn = widgets.slice(widgets.indexOf("export function InstructionMix"));
    const body = fn.slice(0, fn.indexOf("\n}\n") + 3);
    expect(body).toContain("/ww-instruction-mix.json");
    expect(body).not.toContain("ww-onchain-daily.json");
  });

  it("omits endBattle rather than guess it", () => {
    // The census gives 1,506 battles with a distribution and 1,550 with a
    // winner decided. Neither is provably the count of end_battle CALLS, and a
    // bar nobody can defend does not go on a public chart.
    expect(Object.keys(mix.calls)).not.toContain("endBattle");
  });
});
