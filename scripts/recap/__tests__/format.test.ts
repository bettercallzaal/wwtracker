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

  it("normalizes the top battle's winner name via battleName (handle-first)", () => {
    // Regression test: winner should be shown by handle if available, not raw title
    const battleWithWinnerHandle: StoredBattle = {
      id: "1781140240", type: "MAIN", date: "Jun 11, 2026",
      a: "Geek Myth", b: "Opponent", aHandle: "GeEkMyTh_ETH", bHandle: null,
      winner: "Geek Myth", vol: 10.5, margin: null,
    };
    const draft = buildShowRecap("2026-06-15", [battleWithWinnerHandle], null, context);
    // topLine should show "Title (Handle)" consistently for both the participant and the winner
    expect(draft.farcaster).toContain("Geek Myth (GeEkMyTh_ETH) vs Opponent (Geek Myth (GeEkMyTh_ETH) won");
  });

  it("keeps a self-battle (same handle, different songs) distinguishable", () => {
    // Real case found via live data: one artist entering two of their own songs
    // against each other. Handle-only display would collapse both sides to the
    // same string ("BennyJ504WaveWarz vs BennyJ504WaveWarz") - meaningless.
    const selfBattle: StoredBattle = {
      id: "1783995355", type: "QUICK", date: "2026-06-15",
      a: "Modern Love", b: "Saturday in La Featuring DopeStilo",
      aHandle: "BennyJ504WaveWarz", bHandle: "BennyJ504WaveWarz",
      winner: "Saturday in La Featuring DopeStilo", vol: 1.1327, margin: 91,
    };
    const draft = buildShowRecap("2026-06-15", [selfBattle], null, context);
    expect(draft.farcaster).toContain("Modern Love (BennyJ504WaveWarz) vs Saturday in La Featuring DopeStilo (BennyJ504WaveWarz)");
  });
});

describe("buildWeeklyRecap", () => {
  it("reports battle count, total volume, and the top-volume battle", () => {
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.dataUsed.some((l) => l.includes("Battles this week: 2"))).toBe(true);
    expect(draft.dataUsed.some((l) => l.includes("Top-volume battle"))).toBe(true);
  });

  it("includes the winner in the Farcaster and X drafts for the top-volume battle", () => {
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    // mainEvent is the top-volume battle; winner is Geek Myth (GeEkMyTh_ETH)
    expect(draft.farcaster).toContain("Geek Myth (GeEkMyTh_ETH) wins");
    expect(draft.x).toContain("Geek Myth (GeEkMyTh_ETH) wins");
  });

  it("includes the winner in dataUsed for the top-volume battle", () => {
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.dataUsed.some((l) => l.includes("Top-volume battle") && l.includes("Geek Myth (GeEkMyTh_ETH) wins"))).toBe(true);
  });

  it("X draft includes the top battle, not just count+vol", () => {
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.x).toContain("Top:");
    expect(draft.x).toContain("Geek Myth");
  });

  it("includes 'Including N Main Event(s)' in Farcaster when week has MAIN battles", () => {
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.farcaster).toContain("Including 1 Main Event.");
  });

  it("uses plural 'Main Events' when count > 1", () => {
    const secondMain: StoredBattle = {
      id: "2", type: "MAIN", date: "Jun 12, 2026",
      a: "Song X", b: "Song Y", aHandle: null, bHandle: null,
      winner: "Song X", vol: 5, margin: null,
    };
    const draft = buildWeeklyRecap([mainEvent, secondMain], "2026-06-09", "2026-06-15", context);
    expect(draft.farcaster).toContain("Including 2 Main Events.");
  });

  it("omits Main Events line when week has no MAIN battles", () => {
    const draft = buildWeeklyRecap([quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.farcaster).not.toContain("Main Event");
  });

  it("dataUsed battle count includes MAIN vs QUICK breakdown", () => {
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.dataUsed.some((l) => l.includes("1 MAIN") && l.includes("1 QUICK/COMMUNITY"))).toBe(true);
  });

  it("includes the closest-margin battle in the Farcaster draft when one exists", () => {
    // quickBattle has margin=96; mainEvent has margin=null — quickBattle is the closest
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.farcaster).toContain("Closest:");
    expect(draft.farcaster).toContain("96%");
  });

  it("omits Closest line when no battles have a margin", () => {
    const draft = buildWeeklyRecap([mainEvent], "2026-06-09", "2026-06-15", context);
    expect(draft.farcaster).not.toContain("Closest:");
  });

  it("flags leaderboard movement as not included", () => {
    const draft = buildWeeklyRecap([mainEvent], "2026-06-09", "2026-06-15", context);
    expect(draft.notIncluded.some((l) => l.includes("Leaderboard movement"))).toBe(true);
  });

  it("aggregates 'most active artist' by handle across different-titled battles", () => {
    // Same artist (handle "BennyJ504WaveWarz"), two different songs across two
    // different battles - must count as 2 appearances for that ONE artist, not
    // as two separate one-off entries keyed by the "Title (Handle)" display string.
    const battleOne: StoredBattle = {
      id: "1", type: "QUICK", date: "Jun 10, 2026", a: "Modern Love", b: "Filler",
      aHandle: "BennyJ504WaveWarz", bHandle: null, winner: "Modern Love", vol: 1, margin: 90,
    };
    const battleTwo: StoredBattle = {
      id: "2", type: "QUICK", date: "Jun 11, 2026", a: "Filler2", b: "On Repeat",
      aHandle: null, bHandle: "BennyJ504WaveWarz", winner: "On Repeat", vol: 1, margin: 90,
    };
    const draft = buildWeeklyRecap([battleOne, battleTwo], "2026-06-09", "2026-06-15", context);
    expect(draft.dataUsed.some((l) => l.includes("Most active artist: BennyJ504WaveWarz, 2 battle(s)"))).toBe(true);
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
