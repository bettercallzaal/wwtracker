import { describe, it, expect } from "vitest";
import { DATA_AS_OF, FRESHNESS } from "@/lib/freshness";

describe("DATA_AS_OF", () => {
  it("is a valid YYYY-MM-DD ISO date string", () => {
    expect(DATA_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = Date.parse(`${DATA_AS_OF}T00:00:00Z`);
    expect(Number.isNaN(d)).toBe(false);
  });

  it("is not in the future", () => {
    const then = Date.parse(`${DATA_AS_OF}T00:00:00Z`);
    expect(then).toBeLessThanOrEqual(Date.now());
  });
});

describe("FRESHNESS", () => {
  it("contains at least a live-data key", () => {
    const values = Object.values(FRESHNESS);
    expect(values.some((v) => v === "live")).toBe(true);
  });

  // Three legal values, and no fourth. "live" means fetched per request,
  // "manual" means a human maintains it and no date would be honest, and
  // anything else must be a real date. A free-text value here is how a dataset
  // ends up with a reassuring label and no verifiable age.
  it("all values are a valid ISO date, 'live', or 'manual'", () => {
    for (const [key, val] of Object.entries(FRESHNESS)) {
      if (val === "live" || val === "manual") continue;
      expect(val, `FRESHNESS["${key}"] must be YYYY-MM-DD, live, or manual`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
    }
  });

  it("no dated value is in the future", () => {
    for (const [key, val] of Object.entries(FRESHNESS)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) continue;
      expect(
        Date.parse(`${val}T00:00:00Z`),
        `FRESHNESS["${key}"] is dated in the future`,
      ).toBeLessThanOrEqual(Date.now());
    }
  });
});

// Every stamp against its source. These were typed by hand until 2026-09-11 and
// had drifted three ways at once (DATA_AS_OF 08-25 against data running to
// 09-05, a banner calling a 3-day-old file 16 days old, and SOL/USD a stamp
// behind lib/price.ts). A stamp that nobody re-derives is a guess with a date on.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BATTLES_AS_OF } from "@/lib/freshness";
import { SOL_USD_AS_OF } from "@/lib/price";
import { WW } from "@/lib/wwData";
import { LEADERBOARD_AS_OF } from "@/lib/leaderboard";

const root = fileURLToPath(new URL("../../", import.meta.url));
const json = (rel: string) => JSON.parse(readFileSync(`${root}${rel}`, "utf8"));
const newest = (rows: Array<{ date?: string }>) =>
  rows.map((r) => r.date).filter((d): d is string => !!d).sort().at(-1);
// ww-battles.json dates read "Sep 8, 2026"; everything else is ISO.
const iso = (d: string) => new Date(`${d} UTC`).toISOString().slice(0, 10);

const SOURCE: Record<string, () => string> = {
  "on-chain daily activity (Dune, from 2025-05-26)": () => newest(json("public/ww-onchain-daily.json"))!,
  "buys, sells, claims per day (chain scan)": () => json("public/ww-chain-daily.json").measuredThrough,
  "instruction mix (chain scan)": () => json("public/ww-instruction-mix.json").measuredThrough,
  "platform volume timeline (per-battle, from 2025-05-28)": () => newest(json("public/ww-platform-volume.json"))!,
  "program + treasury snapshot (lib/wwData.ts)": () => WW.platformStats.lastDay,
  "SOL/USD reference price": () => SOL_USD_AS_OF,
  "artist roster for static routes (lib/leaderboard.ts)": () => LEADERBOARD_AS_OF,
  "battle history file (recap tooling, npm run fetch:battles)": () =>
    (json("public/ww-battles.json") as Array<{ date: string }>).map((b) => iso(b.date)).sort().at(-1)!,
};

describe("every freshness stamp is its source's own date", () => {
  it("has a source for every dated entry", () => {
    // The artist roster was the one exemption - its date lived only in a
    // comment - until LEADERBOARD_AS_OF made it a value (2026-09-11).
    const dated = Object.entries(FRESHNESS).filter(([, v]) => /^\d{4}-/.test(v)).map(([k]) => k);
    const unsourced = dated.filter((k) => !SOURCE[k]);
    expect(unsourced).toEqual([]);
  });

  for (const [key, derive] of Object.entries(SOURCE)) {
    it(`"${key}" matches its source`, () => {
      expect(FRESHNESS[key]).toBe(derive());
    });
  }

  it("DATA_AS_OF is the oldest dated dataset the homepage bakes", () => {
    // The artist roster feeds only the static /artist/* routes.
    const homepage = Object.entries(FRESHNESS)
      .filter(([k, v]) => /^\d{4}-/.test(v) && !k.startsWith("artist roster"))
      .map(([, v]) => v)
      .sort();
    expect(DATA_AS_OF).toBe(homepage[0]);
  });

  it("the battle stats endpoint is stamped with the battle file's date", () => {
    expect(BATTLES_AS_OF).toBe(SOURCE["battle history file (recap tooling, npm run fetch:battles)"]());
    const route = readFileSync(`${root}app/api/battles/stats/route.ts`, "utf8");
    expect(route).toContain("asOf: BATTLES_AS_OF");
  });
});
