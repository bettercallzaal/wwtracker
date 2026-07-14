import { describe, it, expect } from "vitest";
import { findLeaderboardEntry, findDayActivity } from "@/scripts/recap/context";
import type { LeaderboardEntry, DayActivityEntry } from "@/scripts/recap/context";

const board: LeaderboardEntry[] = [
  { name: "Geek Myth", handle: "GeEkMyTh_ETH", rank: 3, rec: "3W-0L", win: 100 },
  { name: "Lui", handle: "Cryptogodlui", rank: 1, rec: "4W-0L", win: 100 },
];

describe("findLeaderboardEntry", () => {
  it("matches by handle (case-insensitive)", () => {
    const entry = findLeaderboardEntry(board, "geekmyth_eth", "irrelevant");
    expect(entry).toEqual({ rank: 3, record: "3W-0L", winPct: 100 });
  });

  it("falls back to matching by display name when no handle given", () => {
    const entry = findLeaderboardEntry(board, null, "Lui");
    expect(entry).toEqual({ rank: 1, record: "4W-0L", winPct: 100 });
  });

  it("returns null when nothing matches", () => {
    expect(findLeaderboardEntry(board, "nobody", "Nobody")).toBeNull();
  });
});

describe("findDayActivity", () => {
  const activities: DayActivityEntry[] = [
    { date: "2026-06-15", buys: 54, sells: 36, battles: 2, settled: 3, claims: 19 },
  ];

  it("finds the matching day", () => {
    expect(findDayActivity(activities, "2026-06-15")).toEqual(activities[0]);
  });

  it("returns null when the date isn't present", () => {
    expect(findDayActivity(activities, "2026-01-01")).toBeNull();
  });
});
