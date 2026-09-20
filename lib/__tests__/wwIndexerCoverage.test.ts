/**
 * PRD 33 and 34.
 *
 * The interesting assertions here are not about counting. They are about the
 * authority column, which is the thing section 33 actually says and which no
 * coverage checklist would capture: an indexer scoring 17 of 17 while claiming
 * authority over settlement is worse than one scoring 12 and saying so.
 */
import { describe, expect, it } from "vitest";
import {
  INDEXER_REQUIREMENTS,
  assessIndexerCoverage,
  formatCoverage,
  type Observation,
} from "../ww/indexerCoverage";

const none: Observation = {};
const all: Observation = Object.fromEntries(
  INDEXER_REQUIREMENTS.map((r) => [r.id, "covered" as const]),
);

describe("the seventeen", () => {
  it("has exactly the seventeen PRD 34 lists", () => {
    expect(INDEXER_REQUIREMENTS).toHaveLength(17);
    expect(new Set(INDEXER_REQUIREMENTS.map((r) => r.id)).size).toBe(17);
  });

  it("gives every one an authority and a reason", () => {
    for (const r of INDEXER_REQUIREMENTS) {
      expect(["chain", "indexer", "operator"]).toContain(r.authority);
      expect(r.note.length).toBeGreaterThan(20);
    }
  });

  it("puts settlement under the chain, which is section 33's whole point", () => {
    const s = INDEXER_REQUIREMENTS.find((r) => r.id === "settlement")!;
    expect(s.authority).toBe("chain");
  });

  it("puts the WINNER under the indexer, because the judged result is off chain", () => {
    // The distinction that cost this estate two days: the settlement winner is
    // a chain fact at offset 244, the judged winner is not, and they disagree
    // on about one battle in eight.
    const w = INDEXER_REQUIREMENTS.find((r) => r.id === "winner")!;
    expect(w.authority).toBe("indexer");
    expect(w.note).toMatch(/one battle in eight/);
  });
});

describe("scoring", () => {
  it("treats an unmentioned requirement as absent, never as covered", () => {
    const rep = assessIndexerCoverage(none);
    expect(rep.absent).toBe(17);
    expect(rep.covered).toBe(0);
    // The dangerous default would be the other way: an indexer that says
    // nothing would score perfectly.
    expect(rep.chainCheckable).toBe(0);
  });

  it("counts states that add up to the seventeen", () => {
    const rep = assessIndexerCoverage({ buys: "covered", sells: "partial" });
    expect(rep.covered + rep.partial + rep.absent).toBe(17);
  });

  it("marks a served chain fact as a restatement, which is normal and not a fault", () => {
    const rep = assessIndexerCoverage({ pool_changes: "covered" });
    const row = rep.rows.find((r) => r.id === "pool_changes")!;
    expect(row.restatesChain).toBe(true);
  });

  it("does not mark an indexer-owned field as restating chain", () => {
    const rep = assessIndexerCoverage({ swap_activity: "covered" });
    expect(rep.rows.find((r) => r.id === "swap_activity")!.restatesChain).toBe(false);
    expect(rep.indexerOnly).toBe(1);
  });

  it("counts partial as served for authority purposes", () => {
    // Half-serving settlement still means a consumer can read it and believe it.
    const rep = assessIndexerCoverage({ settlement: "partial" });
    expect(rep.authorityWarnings.length).toBe(1);
    expect(rep.rows.find((r) => r.id === "settlement")!.restatesChain).toBe(true);
  });
});

describe("the authority warnings, which are the point", () => {
  it("stays silent when the indexer serves neither settlement nor battle end", () => {
    expect(assessIndexerCoverage({ buys: "covered", swap_activity: "covered" }).authorityWarnings).toEqual([]);
  });

  it("warns on both when an indexer serves both", () => {
    const rep = assessIndexerCoverage({ settlement: "covered", battle_end: "covered" });
    expect(rep.authorityWarnings).toHaveLength(2);
    for (const w of rep.authorityWarnings) expect(w).toMatch(/Re-read it from chain/);
  });

  it("warns even on a perfect score, which is the case worth catching", () => {
    // 17 of 17 and still not the authority for two of them.
    const rep = assessIndexerCoverage(all);
    expect(rep.covered).toBe(17);
    expect(rep.authorityWarnings).toHaveLength(2);
    // Counted from INDEXER_REQUIREMENTS, not from the prose above it. The
    // module's own doc comment said 11 and 4 until this assertion disagreed.
    expect(rep.chainCheckable).toBe(13);
    expect(rep.indexerOnly).toBe(3);
    expect(rep.chainCheckable + rep.indexerOnly + 1).toBe(17); // +1 operator
  });
});

describe("formatting", () => {
  it("prints one line per requirement, each naming its authority", () => {
    const lines = formatCoverage(assessIndexerCoverage(none));
    expect(lines).toHaveLength(17);
    for (const l of lines) expect(l).toMatch(/authority: (chain|indexer|operator)/);
  });
});
