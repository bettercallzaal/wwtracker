/**
 * The night's own numbers, out of the samples the watcher already stored.
 *
 * The finals of 2026-09-20 were written up from screenshots and memory, and
 * the figures that mattered - when the pools moved, how much arrived at the
 * end - were recovered from chain days later. The samples existed the whole
 * time and nothing read them.
 *
 * The rule this module is held to: a pool series is READINGS, not trades. Two
 * trades between two polls read as one move, so nothing here counts trades.
 */
import { describe, expect, it } from "vitest";
import { buildNightRecord, describeNightRecord } from "../ww/nightRecord";
import type { PoolSample } from "../ww/poolHistory";

const START = 1_790_000_000;
const END = START + 600;
const s = (t: number, a: number, b: number, sa = 0, sb = 0): PoolSample => ({ t: START + t, a, b, sa, sb });

describe("buildNightRecord", () => {
  const samples = [
    s(0, 0, 0),
    s(30, 10_000_000, 0, 100_000, 0),       // a buy on A
    s(60, 10_000_000, 5_000_000, 100_000, 50_000), // a buy on B
    s(300, 10_000_000, 5_000_000, 100_000, 50_000), // heartbeat, nothing moved
    s(595, 60_000_000, 5_000_000, 300_000, 50_000), // the late one
  ];

  it("finds every observed move and nothing else", () => {
    const r = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples });
    expect(r.moves.map((m) => [m.side, m.deltaLamports, m.intoBattle])).toEqual([
      ["a", 10_000_000, 30],
      ["b", 5_000_000, 60],
      ["a", 50_000_000, 595],
    ]);
    // The heartbeat sample moved nothing and must not appear as a move.
    expect(r.moves).toHaveLength(3);
  });

  it("names the largest increase and the final-minute activity", () => {
    const r = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples });
    expect(r.largestMove).toMatchObject({ side: "a", deltaLamports: 50_000_000, intoBattle: 595 });
    expect(r.lastMinuteMoves).toHaveLength(1);
    expect(r.firstMoveIntoBattle).toBe(30);
  });

  it("does not mistake a sell for the largest buy", () => {
    const withSell = [...samples, s(598, 20_000_000, 5_000_000, 150_000, 50_000)];
    const r = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples: withSell });
    expect(r.largestMove!.deltaLamports).toBe(50_000_000);
    expect(r.moves.some((m) => m.deltaLamports < 0)).toBe(true);
  });

  it("reports coverage against the battle clock, and never over 100%", () => {
    const full = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples });
    expect(Math.round(full.coverage * 100)).toBe(99);
    // A watcher that keeps sampling through the settle grace has not covered
    // more than the whole battle.
    const past = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples: [...samples, s(900, 60_000_000, 5_000_000)] });
    expect(past.coverage).toBe(1);
    // Half a battle is half, and the write-up has to say so.
    const half = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples: [s(0, 0, 0), s(300, 1, 0)] });
    expect(Math.round(half.coverage * 100)).toBe(50);
    expect(describeNightRecord(half).join("\n")).toMatch(/Coverage is 50%/);
  });

  it("says plainly when nothing moved, rather than leaving it blank", () => {
    const quiet = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples: [s(0, 0, 0), s(300, 0, 0)] });
    expect(quiet.largestMove).toBeNull();
    expect(quiet.firstMoveIntoBattle).toBeNull();
    const text = describeNightRecord(quiet).join("\n");
    expect(text).toMatch(/No pool movement was observed at all/);
    expect(text).toMatch(/Nothing moved in the final minute/);
  });

  it("survives an empty store file without inventing a battle", () => {
    const none = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples: [] });
    expect(none).toMatchObject({ samples: 0, coverage: 0, firstSampleT: null, largestMove: null });
    expect(describeNightRecord(none).join("\n")).toMatch(/0 samples recorded/);
  });

  it("carries the caveat into the write-up, because the number invites the wrong reading", () => {
    const r = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples });
    expect(describeNightRecord(r).join("\n")).toMatch(/readings, not trades/);
  });
});

describe("describeNightRecord extras", () => {
  it("puts chain facts before the caveat, so the caveat stays last", () => {
    const r = buildNightRecord({ battleId: 1, startTime: START, endTime: END, samples: [s(0, 0, 0), s(30, 1, 0)] });
    const lines = describeNightRecord(r, ["- Settled on chain: NO"]);
    const settledAt = lines.findIndex((l) => l.includes("Settled on chain"));
    const caveatAt = lines.findIndex((l) => l.includes("readings, not trades"));
    expect(settledAt).toBeGreaterThan(-1);
    expect(caveatAt).toBeGreaterThan(settledAt);
  });
});
