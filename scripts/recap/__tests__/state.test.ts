import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readState,
  writeState,
  markBattleRecapped,
  markShowRecapped,
  advanceWeeklyCursor,
} from "@/scripts/recap/state";

let dir: string;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("readState", () => {
  it("returns default state when the file doesn't exist", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ww-state-"));
    const state = readState(path.join(dir, "missing.json"));
    expect(state).toEqual({ recappedBattleIds: [], lastWeeklyRecapEnd: null, recappedShowDates: [] });
  });

  it("round-trips through writeState", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ww-state-"));
    const file = path.join(dir, "state.json");
    const state = { recappedBattleIds: ["1"], lastWeeklyRecapEnd: "2026-07-07", recappedShowDates: ["2026-07-12"] };
    writeState(file, state);
    expect(readState(file)).toEqual(state);
  });
});

describe("markBattleRecapped", () => {
  it("adds a new battle id", () => {
    const state = { recappedBattleIds: [], lastWeeklyRecapEnd: null, recappedShowDates: [] };
    expect(markBattleRecapped(state, "1").recappedBattleIds).toEqual(["1"]);
  });

  it("is idempotent for an already-recapped id", () => {
    const state = { recappedBattleIds: ["1"], lastWeeklyRecapEnd: null, recappedShowDates: [] };
    expect(markBattleRecapped(state, "1").recappedBattleIds).toEqual(["1"]);
  });
});

describe("markShowRecapped", () => {
  it("adds a new show date and is idempotent", () => {
    const state = { recappedBattleIds: [], lastWeeklyRecapEnd: null, recappedShowDates: [] };
    const once = markShowRecapped(state, "2026-07-12");
    expect(once.recappedShowDates).toEqual(["2026-07-12"]);
    expect(markShowRecapped(once, "2026-07-12").recappedShowDates).toEqual(["2026-07-12"]);
  });
});

describe("advanceWeeklyCursor", () => {
  it("sets lastWeeklyRecapEnd", () => {
    const state = { recappedBattleIds: [], lastWeeklyRecapEnd: null, recappedShowDates: [] };
    expect(advanceWeeklyCursor(state, "2026-07-14").lastWeeklyRecapEnd).toBe("2026-07-14");
  });
});
