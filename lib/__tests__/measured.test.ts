import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as M from "@/lib/measured";

// Convention 20, enforced rather than agreed: a published figure names its legs
// and its measurement date, and every surface derives from one source.
//
// Three surfaces on this site each carried a hand-maintained copy of these
// numbers and all three drifted - the case-study FAQ, the CITABLE_FACTS block
// beside it, and the Dataset schema in app/layout.tsx, which ships on every
// page. These tests fail if any surface disagrees with lib/measured.ts, so the
// next drift is a red build rather than a live page.

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

describe("the measured figures are internally consistent", () => {
  it("splits the artist total into legs that sum to it", () => {
    expect(M.ARTIST_FEE_LEG_SOL + M.ARTIST_SETTLEMENT_LEG_SOL).toBeCloseTo(
      M.ARTIST_TOTAL_SOL, 2,
    );
  });

  it("keeps the artist fee leg at 1.005% of volume", () => {
    // The artist's 67% share of a 1.500% trade fee. If volume is updated and the
    // fee leg is not, this catches it.
    expect(M.ARTIST_FEE_LEG_SOL / M.VOLUME_SOL).toBeCloseTo(0.01005, 4);
  });

  it("keeps queue fees the majority of platform revenue", () => {
    // The claim the case study rests on: the platform's main income does not
    // scale with volume. If that stops being true the copy needs rewriting.
    expect(M.QUEUE_FEES_SOL).toBeGreaterThan(M.PLATFORM_REVENUE_SOL / 2);
    expect(M.QUEUE_FEES_SOL).toBeLessThan(M.PLATFORM_REVENUE_SOL);
  });

  it("pays artists more than the platform keeps, across all legs", () => {
    expect(M.ARTIST_TOTAL_SOL).toBeGreaterThan(M.PLATFORM_REVENUE_SOL - M.QUEUE_FEES_SOL);
  });

  it("has fewer public battles than chain battles, never more", () => {
    // The gap runs one way: the API invents nothing. If this ever inverts, the
    // census is wrong or the API is returning battles that do not exist.
    expect(M.BATTLES_PUBLIC).toBeLessThan(M.BATTLES_ON_CHAIN);
  });

  it("ranks a subset of the artists that have competed", () => {
    expect(M.RANKED_ARTISTS).toBeLessThan(M.ARTIST_WALLETS);
  });

  it("derives USD rather than carrying it by hand", () => {
    expect(M.VOLUME_USD).toBe(Math.round(M.VOLUME_SOL * M.SOL_USD));
  });

  it("states the same date in all three forms", () => {
    expect(M.MEASURED_ON).toBe("2026-09-07");
    expect(M.MEASURED_ON_LONG).toContain("September 2026");
    expect(M.MEASURED_ON_SHORT).toContain("Sep 2026");
  });
});

describe("every surface agrees with the source", () => {
  it("the site-wide Dataset schema derives from lib/measured", () => {
    const layout = read("app/layout.tsx");
    const block = layout.slice(layout.indexOf('"@type": "Dataset"'));
    // Hardcoded figures are the defect. The schema must interpolate.
    expect(block).toContain("M.BATTLES_ON_CHAIN");
    expect(block).toContain("M.VOLUME_SOL");
    expect(block).toContain("M.ARTIST_TOTAL_SOL");
    expect(block).toContain("dateModified: M.MEASURED_ON");
    // The superseded values, which shipped on every page of the site.
    expect(block).not.toContain("1,500 battles");
    expect(block).not.toContain("921+ SOL");
    // Artist earnings are measured now, not estimated.
    expect(block).not.toContain("estimated artist earnings");
  });

  // This used to assert the case study CONTAINED each literal - "1,643",
  // "928.21", "7 September 2026". That is the weaker half of the property. It
  // proves the page agrees with the source today and does nothing about
  // tomorrow: on the next re-measure the constant moves, eighteen hand-typed
  // copies do not, and the test goes green on a page that has silently gone
  // stale. Every defect fixed on 2026-09-09 was that exact failure.
  //
  // The page derives from lib/measured now, so agreement is structural. What is
  // worth asserting is that it stayed structural.
  it("the case study derives its figures rather than retyping them", () => {
    const page = read("app/case-study/page.tsx");
    for (const name of [
      "BATTLES_ON_CHAIN_FMT",
      "BATTLES_PUBLIC_FMT",
      "VOLUME_SOL",
      "ARTIST_TOTAL_SOL",
      "ARTIST_FEE_LEG_SOL",
      "ARTIST_SETTLEMENT_LEG_SOL",
      "PLATFORM_REVENUE_SOL",
      "QUEUE_FEES_SOL",
      "ARTIST_WALLETS_FMT",
      "RANKED_ARTISTS",
      "MEASURED_ON_LONG",
      "MEASURED_ON_SHORT",
    ]) {
      expect({ name, referenced: page.includes(`M.${name}`) }).toEqual({ name, referenced: true });
    }
  });

  it("no surface retypes a measured figure it could derive", () => {
    // The literal forms, in the files that already import lib/measured. A hit
    // here means a sibling was added by hand next to derived ones - which is
    // how #243 happened, and it is invisible while the two agree.
    const LITERALS: Array<[string, string]> = [
      [M.BATTLES_ON_CHAIN.toLocaleString("en-US"), "M.BATTLES_ON_CHAIN_FMT"],
      [String(M.VOLUME_SOL), "M.VOLUME_SOL"],
      [String(M.ARTIST_TOTAL_SOL), "M.ARTIST_TOTAL_SOL"],
      [String(M.PLATFORM_REVENUE_SOL), "M.PLATFORM_REVENUE_SOL"],
      [String(M.QUEUE_FEES_SOL), "M.QUEUE_FEES_SOL"],
      [M.MEASURED_ON_LONG, "M.MEASURED_ON_LONG"],
    ];
    for (const rel of ["app/case-study/page.tsx", "app/ecosystem/page.tsx", "lib/surfaces.ts"]) {
      const src = read(rel);
      for (const [literal, use] of LITERALS) {
        for (const line of src.split("\n")) {
          if (!line.includes(literal)) continue;
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
          expect({ rel, literal, use, retyped: true }).toEqual({ rel, literal, use, retyped: false });
        }
      }
    }
  });
});
