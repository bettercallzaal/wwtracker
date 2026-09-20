/**
 * The whitepaper's rules, as tests rather than as intentions.
 *
 * The last test is the one that matters most: it reads the page source and
 * fails if a number the figures compute has also been typed into the prose.
 * Without it "no sentence hard-codes a figure" is a comment somebody will
 * violate in six weeks while adding a paragraph, and the page will carry two
 * versions of the same fact with no way for a reader to tell which is current.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildFigures,
  renderFigure,
  freshnessNote,
  type Cached,
  type ChainShape,
  type StatsShape,
} from "../paperFigures";
import { paperEnabled, PAPER_REVALIDATE_SECONDS } from "../paperFlag";

const live = <T,>(data: T): Cached<T> => ({
  status: "live",
  fetchedAt: "2026-09-20T15:00:00.000Z",
  ageSeconds: 0,
  data,
});
const unknown = <T,>(): Cached<T> => ({
  status: "unknown",
  fetchedAt: null,
  ageSeconds: null,
  data: null,
});
const stale = <T,>(data: T, age: number): Cached<T> => ({
  status: "stale",
  fetchedAt: "2026-09-20T09:00:00.000Z",
  ageSeconds: age,
  data,
});

const STATS: StatsShape = {
  updatedAt: "2026-09-20T15:00:00.000Z",
  solPriceUsd: 108.12,
  volume: { totalSol: 921.9965 },
  artistPayouts: { totalSol: 14.473 },
  battles: { total: 1558, mainEvents: 61 },
};
const CHAIN: ChainShape = { battleAccounts: 1694, settled: 1613, readAt: "2026-09-20T15:00:00.000Z" };

describe("the flag", () => {
  it("is off unless explicitly on", () => {
    for (const v of [undefined, "", "0", "false", "no", "off", "maybe"]) {
      expect(paperEnabled({ WW_PAPER: v })).toBe(false);
    }
    for (const v of ["1", "true", "YES", " on "]) {
      expect(paperEnabled({ WW_PAPER: v })).toBe(true);
    }
  });

  it("rebuilds hourly, per the 2026-09-20 ruling", () => {
    expect(PAPER_REVALIDATE_SECONDS).toBe(3600);
  });
});

describe("a source that is down", () => {
  it("never renders a zero for a number it could not read", () => {
    const figures = buildFigures({ stats: unknown<StatsShape>(), chain: unknown<ChainShape>() });
    const live = figures.filter((f) => f.kind !== "dated-observation");
    for (const f of live) {
      expect(f.value).toBeNull();
      expect(f.status).toBe("unknown");
      expect(renderFigure(f)).toBe("unavailable");
      expect(renderFigure(f)).not.toMatch(/0/);
    }
  });

  it("never renders an empty string either, which says nothing", () => {
    const figures = buildFigures({ stats: unknown<StatsShape>(), chain: unknown<ChainShape>() });
    for (const f of figures) expect(renderFigure(f).trim().length).toBeGreaterThan(0);
  });

  it("shows the last good value with its age when the source is merely stale", () => {
    const figures = buildFigures({ stats: stale(STATS, 7200), chain: unknown<ChainShape>() });
    const payouts = figures.find((f) => f.id === "payouts_sol")!;
    expect(payouts.value).toBe(14.473);
    expect(payouts.status).toBe("stale");
    expect(freshnessNote(payouts)).toMatch(/last good read, 120 minutes old/);
  });

  it("treats a present envelope with an absent number as unknown", () => {
    // The dangerous case: the fetch succeeded, the field is missing. Guarding on
    // the envelope alone would let undefined through as a rendered blank.
    const figures = buildFigures({ stats: live({ solPriceUsd: 108 } as StatsShape), chain: unknown<ChainShape>() });
    const payouts = figures.find((f) => f.id === "payouts_sol")!;
    expect(payouts.value).toBeNull();
    expect(payouts.status).toBe("unknown");
  });
});

describe("as-of is when the number was read", () => {
  it("carries the read time, not the build time", () => {
    const figures = buildFigures({ stats: live(STATS), chain: live(CHAIN) });
    const v = figures.find((f) => f.id === "volume_sol")!;
    expect(v.asOf).toBe("2026-09-20T15:00:00.000Z");
    expect(freshnessNote(v)).toContain("2026-09-20T15:00:00.000Z");
  });

  it("a dated observation says it is a one-off, and carries no as-of", () => {
    const figures = buildFigures({ stats: live(STATS), chain: live(CHAIN) });
    const obs = figures.find((f) => f.id === "launch_fee_observation")!;
    expect(obs.kind).toBe("dated-observation");
    expect(obs.asOf).toBeNull();
    expect(freshnessNote(obs)).toMatch(/one-off check on 2026-09-06, not a live reading/);
  });
});

describe("every figure is sourced", () => {
  it("has a clickable url and a label", () => {
    for (const f of buildFigures({ stats: live(STATS), chain: live(CHAIN) })) {
      expect(f.source.url).toMatch(/^https:\/\//);
      expect(f.source.label.length).toBeGreaterThan(3);
    }
  });

  it("derives the dollar figures rather than carrying them separately", () => {
    const figures = buildFigures({ stats: live(STATS), chain: live(CHAIN) });
    const sol = figures.find((f) => f.id === "payouts_sol")!.value!;
    const usd = figures.find((f) => f.id === "payouts_usd")!.value!;
    expect(usd).toBeCloseTo(sol * STATS.solPriceUsd!, 6);
  });

  it("gives no dollar figure when the price is missing, rather than assuming one", () => {
    const noPrice = { ...STATS, solPriceUsd: undefined };
    const figures = buildFigures({ stats: live(noPrice), chain: live(CHAIN) });
    expect(figures.find((f) => f.id === "payouts_usd")!.value).toBeNull();
    expect(figures.find((f) => f.id === "payouts_sol")!.value).toBe(14.473);
  });
});

/**
 * THE RULE THAT KEEPS THE PROSE TRUE. Everything above tests the figures; this
 * tests the page around them.
 */
describe("no sentence hard-codes a figure the page computes", () => {
  const source = readFileSync(new URL("../../app/paper/page.tsx", import.meta.url), "utf8");

  it("contains no numeric literal that looks like a platform figure", () => {
    // The rule is about what a READER sees, so comments are out of scope - a
    // doc comment citing a date or an HTTP status is not a claim on the page.
    // Style objects are layout, not claims. Everything else is fair game.
    const prose = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/style=\{\{[^}]*\}\}/gs, "");
    const suspicious = [...prose.matchAll(/\b\d[\d,]{2,}(?:\.\d+)?\b/g)].map((m) => m[0]);
    expect(suspicious).toEqual([]);
  });

  it("renders every figure through renderFigure rather than inline", () => {
    expect(source).toContain("renderFigure(f)");
    expect(source).toContain("freshnessNote(f)");
  });

  it("shows the source link for each figure", () => {
    expect(source).toContain("f.source.url");
    expect(source).toContain("f.source.label");
  });

  it("404s when the flag is off, rather than hiding the link", () => {
    expect(source).toContain("notFound()");
    expect(source).toContain("paperEnabled()");
  });
});
