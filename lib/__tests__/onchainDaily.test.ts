import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { correctDuneDays, type RawOnchainDay, type ChainDaily } from "@/lib/onchainDaily";
// Plain ESM, shared with scripts/ww-gen.mjs.
import { correctDay, uncoveredDays } from "@/lib/onchainCorrect.mjs";

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
    else if (/\.(tsx?|mjs)$/.test(entry)) out.push(rel);
  }
  return out;
}

const readJson = <T,>(rel: string) => JSON.parse(readFileSync(join(root, rel), "utf8")) as T;
const DUNE = () => readJson<RawOnchainDay[]>("public/ww-onchain-daily.json");
const CHAIN = () => readJson<ChainDaily>("public/ww-chain-daily.json");

describe("correcting the Dune series - transposition and failed attempts", () => {
  const raw: RawOnchainDay = {
    date: "2026-09-04", txs: 93, traders: 9,
    buys: 43, sells: 13, claims: 8,
    created: 10, settled: 9, minted: 10,
  };
  const chainDay = { date: "2026-09-04", buys: 41, sells: 7, claims: 13 };

  it("takes buys, sells and claims from chain, not from Dune", () => {
    const fixed = correctDay(raw, chainDay);
    expect(fixed).toMatchObject({ buys: 41, sells: 7, claims: 13 });
  });

  it("keeps Dune's excess as failed attempts, after undoing its swap", () => {
    // Dune says buys 43, sells 8 (its claims column), claims 13 (its sells).
    // Chain says 41 / 7 / 13. Excess: 2 + 1 + 0.
    expect(correctDay(raw, chainDay).failedAttempts).toBe(3);
  });

  it("leaves every column the scan does not cover alone", () => {
    expect(correctDay(raw, chainDay)).toMatchObject({
      date: "2026-09-04", txs: 93, traders: 9, created: 10, settled: 9, minted: 10,
    });
  });

  it("refuses to run without the chain file rather than fall back to Dune", () => {
    // The fallback is the bug: rendering failed attempts as trades.
    expect(() => correctDuneDays([raw], undefined as unknown as ChainDaily)).toThrow(/refusing/);
  });

  it("refuses a Dune day the chain file does not cover", () => {
    expect(() => correctDuneDays([{ ...raw, date: "2099-01-01" }], CHAIN())).toThrow(/regenerate/);
  });

  it("covers every day in the committed Dune file", () => {
    // A Dune refresh that outruns the chain scan fails HERE, in CI, instead of
    // throwing in a visitor's browser.
    expect(uncoveredDays(DUNE(), CHAIN())).toEqual([]);
  });

  it("matches the chain scan exactly on the full file", () => {
    const fixed = correctDuneDays(DUNE(), CHAIN());
    const sum = (k: "buys" | "sells" | "claims") => fixed.reduce((s, d) => s + d[k], 0);
    // Chain scan through 2026-09-05, the last day both cover. Exact, where it
    // used to be "within 4%" - and 4% is what hid 3.7% of failed attempts.
    // 9,297 / 2,671 / 3,388 until 2026-09-10: the scan was one battle short.
    expect({ buys: sum("buys"), sells: sum("sells"), claims: sum("claims") })
      .toEqual({ buys: 9307, sells: 2673, claims: 3392 });
  });

  it("Dune is never below chain on a complete day, on any leg", () => {
    // The finding the correction rests on: Dune = chain + failed attempts, so
    // after undoing the swap it can exceed chain but never fall short. If this
    // fails, Dune is missing successful trades and "the excess is failed
    // attempts" is no longer the whole story.
    //
    // The file's LAST day is exempt: the Dune pull ran during it, so it is
    // partial (2026-09-05: Dune 13 claims, chain 14).
    const dune = DUNE();
    const chain = new Map(CHAIN().days.map((r) => [r.date, r]));
    const short: string[] = [];
    for (const d of dune.slice(0, -1)) {
      const c = chain.get(d.date) ?? { buys: 0, sells: 0, claims: 0 };
      if (d.buys < c.buys) short.push(`${d.date} buys ${d.buys} < ${c.buys}`);
      if (d.claims < c.sells) short.push(`${d.date} sells ${d.claims} < ${c.sells}`);
      if (d.sells < c.claims) short.push(`${d.date} claims ${d.sells} < ${c.claims}`);
    }
    expect(short).toEqual([]);
  });

  it("puts lifetime failed attempts at 445 - 339 buys, 89 sells, 17 claims", () => {
    // Matches the full-history failed-attempt count (wavewarz-protocol
    // tools/failed-daily.py) on every complete day. It said 461 until the
    // snapshot's missing battle was filled: its 16 real trades were being
    // counted as failed. Claims net 17 against 18 failed because the Dune file's
    // last day is partial.
    const fixed = correctDuneDays(DUNE(), CHAIN());
    expect(fixed.reduce((s, d) => s + d.failedAttempts, 0)).toBe(445);
  });

  it("reports more claims than sells, which is the shape chain has", () => {
    const fixed = correctDuneDays(DUNE(), CHAIN());
    const sells = fixed.reduce((s, d) => s + d.sells, 0);
    const claims = fixed.reduce((s, d) => s + d.claims, 0);
    expect(claims).toBeGreaterThan(sells);
  });
});

describe("one correction, not two copies", () => {
  it("no file outside lib/onchainCorrect.mjs re-implements the swap", () => {
    // ww-gen.mjs carried its own copy of the swap until 2026-09-10; this is the
    // shape that let the build and the read disagree. Pattern-based, across
    // every source directory, not a list of files.
    const offenders: string[] = [];
    const files = [...sourceFiles("app"), ...sourceFiles("components"), ...sourceFiles("lib"),
      ...readdirSync(join(root, "scripts")).map((f) => `scripts/${f}`)];
    for (const rel of files) {
      if (rel === "lib/onchainCorrect.mjs" || !/\.(tsx?|mjs|js)$/.test(rel)) continue;
      const text = readFileSync(join(root, rel), "utf8");
      if (/sells:\s*d\.claims[\s\S]{0,40}claims:\s*d\.sells/.test(text)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("the build imports the shared module", () => {
    const gen = readFileSync(join(root, "scripts/ww-gen.mjs"), "utf8");
    expect(gen).toMatch(/from "\.\.\/lib\/onchainCorrect\.mjs"/);
    expect(gen).toContain("correctDays(onchainRaw");
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
