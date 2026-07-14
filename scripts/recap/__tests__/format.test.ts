import { describe, it, expect } from "vitest";
import {
  buildMainEventRecap,
  buildShowRecap,
  buildWeeklyRecap,
  renderRecapMarkdown,
} from "@/scripts/recap/format";
import type { RecapContext } from "@/scripts/recap/format";
import type { StoredBattle } from "@/scripts/recap/types";

const context: RecapContext = {
  leaderboard: [{ name: "Geek Myth", handle: "GeEkMyTh_ETH", rank: 3, rec: "3W-0L", win: 100 }],
  activity: [{ date: "2026-06-15", buys: 54, sells: 36, battles: 2, settled: 3, claims: 19 }],
};

const mainEvent: StoredBattle = {
  id: "1781140240", type: "MAIN", date: "Jun 11, 2026",
  a: "Geek Myth", b: "Taji Kamikaze", aHandle: "GeEkMyTh_ETH", bHandle: null,
  winner: "Geek Myth", vol: 11.099, margin: null,
};

const quickBattle: StoredBattle = {
  id: "1781318838", type: "QUICK", date: "Jun 13, 2026",
  a: "Fuck yo feelingZ", b: "ACCELERATE", aHandle: null, bHandle: null,
  winner: "Fuck yo feelingZ", vol: 0.261, margin: 96,
};

describe("buildMainEventRecap", () => {
  it("names the winner and cites the source", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    expect(draft.farcaster).toContain("GeEkMyTh_ETH");
    expect(draft.dataUsed.some((l) => l.includes("public/ww-battles.json") && l.includes("1781140240"))).toBe(true);
  });

  it("includes leaderboard standing when the winner is on the board", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    expect(draft.dataUsed.some((l) => l.includes("rank 3"))).toBe(true);
  });

  it("lists per-battle payout and trade data as not included", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    expect(draft.notIncluded.some((l) => l.includes("payout"))).toBe(true);
  });

  it("has no NaN or undefined anywhere in the output", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    const all = [draft.farcaster, draft.x, ...draft.dataUsed, ...draft.notIncluded].join(" ");
    expect(all).not.toMatch(/NaN|undefined/);
  });

  it("ends both drafts with the standard tag line", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    expect(draft.farcaster.endsWith("@WaveWarZ - wavewarz.com")).toBe(true);
    expect(draft.x.endsWith("@WaveWarZ - wavewarz.com")).toBe(true);
  });
});

describe("buildShowRecap", () => {
  it("rolls up total volume across the night's battles", () => {
    const draft = buildShowRecap("2026-06-15", [quickBattle, mainEvent], null, context);
    expect(draft.dataUsed.some((l) => l.includes("11.36"))).toBe(true); // 11.099 + 0.261
  });

  it("includes platform activity when available for that date", () => {
    const draft = buildShowRecap("2026-06-15", [quickBattle], null, context);
    expect(draft.dataUsed.some((l) => l.includes("54 buys"))).toBe(true);
  });

  it("adds a stream quote line only when a speaker log with captions exists", () => {
    const withoutLog = buildShowRecap("2026-06-15", [quickBattle], null, context);
    expect(withoutLog.dataUsed.some((l) => l.includes("Stream quote"))).toBe(false);

    const withLog = buildShowRecap(
      "2026-06-15",
      [quickBattle],
      [{ timestampSec: 125, speaker: "Hurric4n3Ike", captionText: "big night for the catalog" }],
      context,
    );
    expect(withLog.dataUsed.some((l) => l.includes("Stream quote"))).toBe(true);
    expect(withLog.farcaster).toContain("02:05");
  });
});

describe("buildWeeklyRecap", () => {
  it("reports battle count, total volume, and the top-volume battle", () => {
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.dataUsed.some((l) => l.includes("Battles this week: 2"))).toBe(true);
    expect(draft.dataUsed.some((l) => l.includes("Top-volume battle"))).toBe(true);
  });

  it("flags leaderboard movement as not included", () => {
    const draft = buildWeeklyRecap([mainEvent], "2026-06-09", "2026-06-15", context);
    expect(draft.notIncluded.some((l) => l.includes("Leaderboard movement"))).toBe(true);
  });
});

describe("renderRecapMarkdown", () => {
  it("produces the expected section headings", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    const md = renderRecapMarkdown("main-event", "Geek Myth vs Taji Kamikaze", "Jun 11, 2026", draft);
    expect(md).toContain("# Main Event Recap - Geek Myth vs Taji Kamikaze - Jun 11, 2026");
    expect(md).toContain("## Draft - Farcaster");
    expect(md).toContain("## Draft - X");
    expect(md).toContain("## Data used");
    expect(md).toContain("## Not included");
  });
});
