/**
 * What a battle night produced, from the samples the watcher stored.
 *
 * WHY. The night leaves `var/ww-live/<id>.jsonl` behind and nothing reads it
 * afterwards except a chart. The finals of 2026-09-20 were written up by hand
 * from screenshots and memory, and the numbers that mattered - when the pools
 * actually moved, how much arrived in the last seconds - had to be recovered
 * from chain days later. The samples were there the whole time.
 *
 * Pure on purpose: it takes samples and an account's own facts and returns
 * numbers. The script around it does the reading.
 *
 * WHAT IT WILL NOT DO IS GUESS. A pool series is a series of READINGS, not a
 * list of trades: two trades between two polls look like one move, and a trade
 * that lands and is undone inside one interval looks like nothing. So the
 * fields below say "moves" and "observed", never "trades", and `coverage`
 * states how much of the battle the samples actually cover.
 */
import type { PoolSample } from "./poolHistory";

export interface PoolMove {
  /** Unix seconds of the reading that showed the move. */
  t: number;
  /** Seconds after the battle opened. */
  intoBattle: number;
  side: "a" | "b";
  /** Lamports the pool changed by; negative for a sell. */
  deltaLamports: number;
  /** The pool after the move. */
  poolLamports: number;
}

export interface NightRecord {
  battleId: number;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  samples: number;
  /** First and last sample times, and what share of the battle they span. */
  firstSampleT: number | null;
  lastSampleT: number | null;
  coverage: number;
  /** Every observed change in either pool, in time order. */
  moves: PoolMove[];
  /** The largest single observed increase, which is what a late buy looks like. */
  largestMove: PoolMove | null;
  /** Moves seen in the final minute of the battle's own clock. */
  lastMinuteMoves: PoolMove[];
  finalPool: { a: number; b: number };
  finalSupply: { a: number; b: number };
  /** Null when no sample fell inside the first 60 seconds. */
  firstMoveIntoBattle: number | null;
}

export function buildNightRecord(p: {
  battleId: number;
  startTime: number;
  endTime: number;
  samples: PoolSample[];
}): NightRecord {
  const sorted = [...p.samples].sort((x, y) => x.t - y.t);
  const duration = Math.max(0, p.endTime - p.startTime);
  const moves: PoolMove[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1], now = sorted[i];
    for (const side of ["a", "b"] as const) {
      const delta = now[side] - prev[side];
      if (delta === 0) continue;
      moves.push({ t: now.t, intoBattle: now.t - p.startTime, side, deltaLamports: delta, poolLamports: now[side] });
    }
  }
  const gains = moves.filter((m) => m.deltaLamports > 0);
  const largest = gains.length
    ? gains.reduce((best, m) => (m.deltaLamports > best.deltaLamports ? m : best))
    : null;
  const first = sorted[0] ?? null;
  const last = sorted[sorted.length - 1] ?? null;
  // Coverage against the battle's own clock, capped at 1: a watcher that keeps
  // sampling through the settle grace period has not covered 110% of anything.
  const covered = first && last ? Math.max(0, Math.min(last.t, p.endTime) - Math.max(first.t, p.startTime)) : 0;
  const coverage = duration > 0 ? Math.min(1, covered / duration) : 0;
  return {
    battleId: p.battleId,
    startTime: p.startTime,
    endTime: p.endTime,
    durationSeconds: duration,
    samples: sorted.length,
    firstSampleT: first?.t ?? null,
    lastSampleT: last?.t ?? null,
    coverage,
    moves,
    largestMove: largest,
    lastMinuteMoves: moves.filter((m) => m.t >= p.endTime - 60 && m.t <= p.endTime),
    finalPool: { a: last?.a ?? 0, b: last?.b ?? 0 },
    finalSupply: { a: last?.sa ?? 0, b: last?.sb ?? 0 },
    firstMoveIntoBattle: moves.length ? moves[0].intoBattle : null,
  };
}

const sol = (lamports: number) => (lamports / 1e9).toFixed(4);

/**
 * The record as lines somebody can paste into a note.
 *
 * `extra` is for facts that do not come from the samples - whether the program
 * has settled the battle, whether any of the file was unreadable - and it is
 * placed BEFORE the closing caveat so the caveat stays the last thing read.
 */
export function describeNightRecord(r: NightRecord, extra: string[] = []): string[] {
  const out = [
    `## Battle ${r.battleId}`,
    ``,
    `- Open ${new Date(r.startTime * 1000).toISOString()}, close ${new Date(r.endTime * 1000).toISOString()} (${r.durationSeconds}s)`,
    `- ${r.samples} samples recorded, covering ${(r.coverage * 100).toFixed(0)}% of the battle's clock`,
    `- Final pools: A ${sol(r.finalPool.a)} SOL, B ${sol(r.finalPool.b)} SOL`,
    `- Final supply: A ${r.finalSupply.a.toLocaleString()}, B ${r.finalSupply.b.toLocaleString()}`,
  ];
  if (r.coverage < 0.9) {
    out.push(`- **Coverage is ${(r.coverage * 100).toFixed(0)}%, so anything below describes only the part that was watched.**`);
  }
  out.push(
    r.firstMoveIntoBattle === null
      ? `- No pool movement was observed at all`
      : `- First observed movement ${r.firstMoveIntoBattle}s after open`,
  );
  if (r.largestMove) {
    out.push(`- Largest single observed increase: ${sol(r.largestMove.deltaLamports)} SOL into side ${r.largestMove.side.toUpperCase()}, ${r.largestMove.intoBattle}s in`);
  }
  out.push(
    r.lastMinuteMoves.length
      ? `- ${r.lastMinuteMoves.length} move(s) in the final minute, ${sol(r.lastMinuteMoves.reduce((n, m) => n + m.deltaLamports, 0))} SOL net`
      : `- Nothing moved in the final minute`,
  );
  out.push(...extra);
  out.push(
    ``,
    `_A pool series is readings, not trades: two trades between two polls read as one move._`,
  );
  return out;
}
