/**
 * Pool history: the pools and supplies of a battle over time, as the watcher
 * saw them, so a page can draw the chart wavewarz.com draws.
 *
 * WHY IT DID NOT EXIST. `scripts/ww-live-watch.ts` has polled every live
 * battle every 3 s since 2026-09-19 and kept nothing queryable: each poll was
 * compared to the last and printed. The finals produced 106 exact trade
 * verdicts and no series anyone could plot. Zaal, 2026-09-21: "just start
 * now", on the chart store and battle page.
 *
 * THIS MODULE IS PURE. The file writes live in `lib/poolHistoryStore.ts`,
 * outside the SDK surface, because `node:fs` has no place in a library a
 * browser imports. Everything here - what to keep, how a line is spelled, how
 * a series is built - is testable without a disk.
 *
 * WHAT IS KEPT. Every poll where a pool or a supply changed, plus a heartbeat
 * sample every `HEARTBEAT_SECONDS` when nothing changed, so a flat stretch on
 * the chart is a measured flat stretch and not a gap. A quiet ten-minute
 * battle is about 20 lines; a busy one is one line per trade.
 */

export interface PoolSample {
  /** Unix seconds when the watcher read it. */
  t: number;
  /** Lamports in each pool. */
  a: number;
  b: number;
  /** Minted supply per side, base units. */
  sa: number;
  sb: number;
}

export const HEARTBEAT_SECONDS = 30;

/** Keep this sample? Changed pools or supplies always; unchanged only on the heartbeat. */
export function shouldRecord(prev: PoolSample | null, next: PoolSample, heartbeatSeconds = HEARTBEAT_SECONDS): boolean {
  if (!prev) return true;
  if (prev.a !== next.a || prev.b !== next.b || prev.sa !== next.sa || prev.sb !== next.sb) return true;
  return next.t - prev.t >= heartbeatSeconds;
}

/** One JSON object per line, fixed key order, no trailing newline. */
export function serializeSample(s: PoolSample): string {
  return JSON.stringify({ t: s.t, a: s.a, b: s.b, sa: s.sa, sb: s.sb });
}

/**
 * Parse a JSONL body. A malformed line is SKIPPED and counted, not fatal: a
 * watcher killed mid-write leaves a torn last line, and one torn line must not
 * blank a whole battle's chart.
 */
export function parseJsonl(text: string): { samples: PoolSample[]; skipped: number } {
  const samples: PoolSample[] = [];
  let skipped = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (
        typeof o.t === "number" && typeof o.a === "number" && typeof o.b === "number" &&
        typeof o.sa === "number" && typeof o.sb === "number"
      ) {
        samples.push({ t: o.t, a: o.a, b: o.b, sa: o.sa, sb: o.sb });
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }
  return { samples, skipped };
}

export interface ChartPoint {
  t: number;
  aSol: number;
  bSol: number;
}

/** Lamports to SOL for the chart, sorted by time, duplicates by time collapsed to the last. */
export function chartSeries(samples: PoolSample[]): ChartPoint[] {
  const byTime = new Map<number, PoolSample>();
  for (const s of samples) byTime.set(s.t, s);
  return [...byTime.values()]
    .sort((x, y) => x.t - y.t)
    .map((s) => ({ t: s.t, aSol: s.a / 1e9, bSol: s.b / 1e9 }));
}
