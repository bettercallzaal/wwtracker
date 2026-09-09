import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { correctDuneDay, correctDuneDays, type RawOnchainDay } from "@/lib/onchainDaily";

// public/ww-onchain-daily.json has `sells` and `claims` transposed, and FOUR
// separate consumers needed that correction. Three of them missed it:
//
//   scripts/ww-gen.mjs             swapped at build time - correct since 09-08
//   components/embeds/Widgets.tsx  published the swap to partner pages
//   components/BattleLifecycle.tsx rendered 2,762 claims and both headline
//                                  ratios wrong (2.83 buys/sell, 1.72
//                                  claims/settled) on the live site
//   components/PlatformAnalytics.tsx plotted sells and claims as two stacked
//                                  series, each carrying the other's data
//
// The pattern is not carelessness, it is placement: the correction lived in a
// build script while the file is ALSO served to the browser, so every client
// fetch bypassed it. Moving it to the read is the fix; this test is what keeps
// it there.

const root = fileURLToPath(new URL("../../", import.meta.url));

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(root, dir))) {
    if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) sourceFiles(rel, out);
    else if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

describe("correcting the transposition", () => {
  const raw: RawOnchainDay = {
    date: "2026-09-05", txs: 93, traders: 9,
    buys: 43, sells: 13, claims: 8,
    created: 10, settled: 9, minted: 10,
  };

  it("puts each count back under its real name", () => {
    const fixed = correctDuneDay(raw);
    expect(fixed.sells).toBe(8);
    expect(fixed.claims).toBe(13);
  });

  it("leaves every column that is not transposed alone", () => {
    const fixed = correctDuneDay(raw);
    expect(fixed).toMatchObject({
      date: "2026-09-05", txs: 93, traders: 9, buys: 43,
      created: 10, settled: 9, minted: 10,
    });
  });

  it("conserves the pair total, which is why aggregates could not catch it", () => {
    const fixed = correctDuneDay(raw);
    expect(fixed.sells + fixed.claims).toBe(raw.sells + raw.claims);
  });

  it("is its own inverse, so applying it twice restores the bug", () => {
    // Stated as a test because it is the failure mode of a partial fix: a
    // component that corrects on top of an already-corrected source is exactly
    // as wrong as one that never corrected at all.
    expect(correctDuneDay(correctDuneDay(raw))).toEqual(raw);
  });

  it("lands within 4% of the chain scan on the full file", () => {
    const rows = JSON.parse(
      readFileSync(join(root, "public/ww-onchain-daily.json"), "utf8"),
    ) as RawOnchainDay[];
    const fixed = correctDuneDays(rows);
    const sum = (k: "buys" | "sells" | "claims") => fixed.reduce((s, d) => s + d[k], 0);
    // Chain scan, 1,643 battles, data/chain-snapshot-2026-09-06.
    const CHAIN = { buys: 9297, sells: 2671, claims: 3390 };
    for (const k of ["buys", "sells", "claims"] as const) {
      const drift = Math.abs(sum(k) - CHAIN[k]) / CHAIN[k];
      expect({ leg: k, within4pc: drift < 0.04 }).toEqual({ leg: k, within4pc: true });
    }
  });

  it("reports more claims than sells, which is the shape chain has", () => {
    const rows = JSON.parse(
      readFileSync(join(root, "public/ww-onchain-daily.json"), "utf8"),
    ) as RawOnchainDay[];
    const fixed = correctDuneDays(rows);
    const sells = fixed.reduce((s, d) => s + d.sells, 0);
    const claims = fixed.reduce((s, d) => s + d.claims, 0);
    expect(claims).toBeGreaterThan(sells);
  });
});

describe("nothing reads the raw file behind the correction's back", () => {
  it("has no direct fetch of ww-onchain-daily.json outside lib/onchainDaily.ts", () => {
    const offenders: string[] = [];
    for (const rel of [...sourceFiles("app"), ...sourceFiles("components"), ...sourceFiles("lib")]) {
      if (rel === "lib/onchainDaily.ts") continue;
      const text = readFileSync(join(root, rel), "utf8");
      // Only the SERVED path is an offence - a quoted "/ww-onchain-daily.json"
      // is a URL something is about to fetch. Prose naming the file on disk
      // ("check that public/ww-onchain-daily.json exists") is not, and banning
      // that would push people to obfuscate the string rather than route the
      // read, which is a worse outcome than the bug.
      for (const line of text.split("\n")) {
        if (!/["'`]\/ww-onchain-daily\.json["'`]/.test(line)) continue;
        if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) continue;
        offenders.push(`${rel}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
