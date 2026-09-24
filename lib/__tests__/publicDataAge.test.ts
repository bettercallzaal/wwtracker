/**
 * The embed widgets draw from four baked files. On 2026-09-24 they were 14 to
 * 19 days old, and looking for the job that should have rebuilt them found
 * there isn't one: the daily workflow runs a contract check, the live-watch
 * workflow has no schedule, and the only Vercel cron refreshes Dune.
 *
 * So the staleness is not a failed job. Nothing has ever rebuilt them
 * automatically, and a reader who assumes a cron exists will keep waiting.
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  classifyAge,
  describePublicDataAges,
  publicDataAges,
  PUBLIC_DATA,
} from "../publicDataAge";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-24T12:00:00Z");
const root = fileURLToPath(new URL("../../", import.meta.url));

describe("the files it watches", () => {
  /**
   * A watcher pointed at a path nothing writes reports a permanent problem
   * nobody can fix, which is how the doctor's own watcher check went wrong.
   */
  it("names files that actually exist in the repo", () => {
    expect(PUBLIC_DATA.length).toBeGreaterThan(0);
    for (const f of PUBLIC_DATA) {
      expect(existsSync(join(root, f.path)), `${f.path} is not in the repo`).toBe(true);
    }
  });

  /**
   * THE FIRST VERSION OF THIS CLAIMED A REBUILD COMMAND FOR ALL FOUR. It
   * listed `node scripts/ww-gen.mjs` for the volume and daily files - a script
   * that READS them and writes `lib/wwData.ts`. An instruction that sends a
   * reader to the consumer of a stale file is worse than none: it looks like
   * the fix has been tried.
   */
  it("names a command only where one exists, and null where none does", () => {
    const byPath = Object.fromEntries(PUBLIC_DATA.map((f) => [f.path, f.rebuiltBy]));
    expect(byPath["public/ww-battles.json"]).toBe("npm run fetch:battles");
    expect(byPath["public/ww-platform-volume.json"]).toBeNull();
    expect(byPath["public/ww-onchain-daily.json"]).toBeNull();
    expect(byPath["public/ww-chain-daily.json"]).toBeNull();
  });

  it("does not name a script that only reads the file", () => {
    // ww-gen.mjs consumes these. If it ever appears here again, this fails.
    for (const f of PUBLIC_DATA) expect(f.rebuiltBy ?? "").not.toMatch(/ww-gen\.mjs/);
  });
});

describe("classifying an age", () => {
  it("is quiet under a fortnight, matching snapshotAge", () => {
    expect(classifyAge(0)).toBe("fresh");
    expect(classifyAge(13)).toBe("fresh");
    expect(classifyAge(14)).toBe("ageing");
  });

  it("calls a month stale, because a chart a month behind is being read as current", () => {
    expect(classifyAge(29)).toBe("ageing");
    expect(classifyAge(30)).toBe("stale");
  });

  /**
   * A MISSING FILE IS NOT ZERO DAYS OLD. Defaulting it to now would report the
   * freshest possible answer for the worst possible state.
   */
  it("keeps missing separate from fresh", () => {
    expect(classifyAge(null)).toBe("missing");
  });
});

describe("the real ages measured on 2026-09-24", () => {
  const mtimes: Record<string, number> = {
    "public/ww-battles.json": Date.parse("2026-09-09T07:40:00Z"),
    "public/ww-platform-volume.json": Date.parse("2026-09-05T02:14:00Z"),
    "public/ww-onchain-daily.json": Date.parse("2026-09-05T02:14:00Z"),
    "public/ww-chain-daily.json": Date.parse("2026-09-10T20:55:00Z"),
  };

  it("reports the ages that were actually on disk", () => {
    const ages = publicDataAges((p) => mtimes[p] ?? null, NOW);
    expect(ages.map((a) => a.days)).toEqual([15, 19, 19, 13]);
    expect(ages.map((a) => a.verdict)).toEqual(["ageing", "ageing", "ageing", "fresh"]);
  });

  it("says nothing at all when every file is fresh", () => {
    const fresh = publicDataAges(() => NOW - 2 * DAY, NOW);
    expect(describePublicDataAges(fresh)).toEqual([]);
  });

  it("names the rebuild command where there is one, and says so where there is not", () => {
    const lines = describePublicDataAges(publicDataAges((p) => mtimes[p] ?? null, NOW)).join("\n");
    expect(lines).toMatch(/ww-battles\.json is 15 days old - rebuild with npm run fetch:battles/);
    expect(lines).toMatch(/ww-platform-volume\.json is 19 days old - NOTHING IN THIS REPO REBUILDS IT/);
    expect(lines).toMatch(/cannot be automated until one is written/);
    // The fresh one is not mentioned, so the list stays worth reading.
    expect(lines).not.toMatch(/ww-chain-daily/);
  });

  /**
   * The line that turns a symptom into a cause. Without it a reader assumes a
   * job failed and waits for the next run.
   */
  it("distinguishes a file that can be rebuilt from one that cannot", () => {
    const lines = describePublicDataAges(publicDataAges((p) => mtimes[p] ?? null, NOW));
    const battles = lines.find((l) => l.includes("ww-battles.json"));
    const volume = lines.find((l) => l.includes("ww-platform-volume.json"));
    expect(battles).toMatch(/rebuild with/);
    expect(volume).not.toMatch(/rebuild with/);
  });

  it("reports a missing file as missing rather than as very old", () => {
    const lines = describePublicDataAges(publicDataAges(() => null, NOW)).join("\n");
    expect(lines).toMatch(/is MISSING - rebuild with/);
    expect(lines).not.toMatch(/days old/);
  });
});
