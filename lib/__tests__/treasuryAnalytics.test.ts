/**
 * The weekly revenue panel on the home page reads public/ww-daily-treasury.csv.
 * Two things it could not say before 2026-09-22:
 *
 *   - whether the file loaded at all: a fetch failure became an empty trend,
 *     identical to a file with no rows, and the page said "No revenue data";
 *   - how old the newest row is: the CSV ends 2026-07-21 and the tiles said
 *     "THIS WEEK" over it, two months later.
 *
 * Both are the shape behind lib/wwCache.ts's live / stale / unknown contract:
 * a consumer that renders unknown as 0 is lying, and a consumer that renders
 * old as current is lying with a date.
 */
import { describe, expect, it } from "vitest";
import { loadWeeklyRevenueFromCsv, parseWeeklyRevenueFromCsv, trendAge } from "../treasuryAnalytics";

const CSV = `date,day,balance_sol,delta_sol,battles_launched,battles_launched_onchain,notes,source
2026-07-13,Monday,1.0,0.5,2,2,,on-chain
2026-07-14,Tuesday,1.2,0.2,1,1,,on-chain
2026-07-20,Monday,1.1,-0.1,3,3,,on-chain
2026-07-21,Tuesday,1.4,0.3,,,,on-chain
`;

describe("parseWeeklyRevenueFromCsv", () => {
  it("names the newest recorded day, so the page can date what it shows", () => {
    const t = parseWeeklyRevenueFromCsv(CSV, 100);
    expect(t.last_recorded_date).toBe("2026-07-21");
    expect(t.current_week?.week_start_date).toBe("2026-07-20");
    expect(t.current_week?.gross_inflow_sol).toBeCloseTo(0.3);
    expect(t.current_week?.battles_count).toBe(3);
  });
  it("has no newest day when the file has no rows", () => {
    const t = parseWeeklyRevenueFromCsv("date,day,balance_sol,delta_sol\n", 100);
    expect(t.last_recorded_date).toBeNull();
    expect(t.current_week).toBeNull();
  });
});

describe("trendAge", () => {
  it("is current within seven days of the newest row and stale after", () => {
    expect(trendAge("2026-07-21", Date.UTC(2026, 6, 24))).toMatchObject({ days: 3, current: true });
    expect(trendAge("2026-07-21", Date.UTC(2026, 8, 22))).toMatchObject({ days: 63, current: false });
  });
  it("is unknown with no newest row", () => {
    expect(trendAge(null, Date.UTC(2026, 8, 22))).toEqual({ days: null, current: false });
  });
});

describe("loadWeeklyRevenueFromCsv", () => {
  it("reports the file as loaded when the fetch answers", async () => {
    const r = await loadWeeklyRevenueFromCsv(100, async () => ({ ok: true, status: 200, text: async () => CSV }));
    expect(r.status).toBe("live");
    expect(r.trend?.last_recorded_date).toBe("2026-07-21");
  });
  it("reports unknown, with the reason, when the fetch fails - never an empty trend", async () => {
    const r = await loadWeeklyRevenueFromCsv(100, async () => ({ ok: false, status: 503, text: async () => "" }));
    expect(r.status).toBe("unknown");
    expect(r.trend).toBeNull();
    expect(r.error).toMatch(/503/);
    const thrown = await loadWeeklyRevenueFromCsv(100, async () => { throw new Error("offline"); });
    expect(thrown).toMatchObject({ status: "unknown", trend: null, error: "offline" });
  });
});
