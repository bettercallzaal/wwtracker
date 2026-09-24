/**
 * What each battle format is, measured over every labelled battle.
 *
 * `brand/FORMATS.md` in wavewarz-protocol was built from the 200 most recent
 * battles the public API returns, and said so as a limitation: "the per-format
 * numbers below describe current practice, not all time." That was the honest
 * shape of the sample available.
 *
 * `public/ww-battles.json` now holds 1,574 labelled battles spanning
 * 2025-05-28 to 2026-09-24 - the whole history - because the refresh that had
 * never been automated finally ran. Joining that to the chain scan gives the
 * same table over eight times the sample and the full time range.
 *
 * TWO POPULATIONS, JOINED ON THE BATTLE ID, and the join is the fragile part:
 * a battle in one and not the other is a real gap, not a rounding error, so
 * `unmatched` is returned rather than silently dropped. A format table built
 * from whatever happened to join is a table whose denominator nobody knows.
 */

export interface LabelledBattle {
  id: number;
  /** `quick`, `main` or `community`, lowercased from the API's shouting. */
  type: string;
}

export interface ChainBattle {
  battleId: number;
  startTime: number;
  endTime: number;
  poolLamports: { a: number; b: number };
}

export interface FormatStat {
  type: string;
  battles: number;
  /** Battles where at least one pool held lamports. */
  traded: number;
  medianDurationSeconds: number | null;
  minDurationSeconds: number | null;
  maxDurationSeconds: number | null;
  /** Over the traded battles only: a median that counted the empties would be zero. */
  medianPoolLamports: number | null;
  maxPoolLamports: number | null;
}

export interface FormatReport {
  stats: FormatStat[];
  /** Labelled battles with no account on chain. */
  unmatched: number;
  /** Chain battles nothing labelled. Not a fault: the API only lists its own. */
  unlabelled: number;
  matched: number;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  // Even counts take the lower of the two middles rather than averaging, so a
  // median duration is always a duration some battle actually ran.
  return s.length % 2 === 1 ? s[mid] : s[mid - 1];
}

export function buildFormatReport(
  labelled: LabelledBattle[],
  chain: ChainBattle[],
): FormatReport {
  const byId = new Map(chain.map((c) => [c.battleId, c]));
  const labelledIds = new Set(labelled.map((l) => l.id));
  const groups = new Map<string, ChainBattle[]>();
  let unmatched = 0;

  for (const l of labelled) {
    const c = byId.get(l.id);
    if (!c) {
      unmatched += 1;
      continue;
    }
    // A clock that did not advance is not a duration. Dropping these quietly
    // would shrink the denominator without saying so, so they are kept out of
    // the duration stats but counted in `battles`.
    const list = groups.get(l.type) ?? [];
    list.push(c);
    groups.set(l.type, list);
  }

  const stats: FormatStat[] = [...groups.entries()]
    .map(([type, list]) => {
      const durations = list
        .map((c) => c.endTime - c.startTime)
        .filter((d) => d > 0);
      const pools = list
        .map((c) => c.poolLamports.a + c.poolLamports.b)
        .filter((p) => p > 0);
      return {
        type,
        battles: list.length,
        traded: pools.length,
        medianDurationSeconds: median(durations),
        minDurationSeconds: durations.length ? Math.min(...durations) : null,
        maxDurationSeconds: durations.length ? Math.max(...durations) : null,
        medianPoolLamports: median(pools),
        maxPoolLamports: pools.length ? Math.max(...pools) : null,
      };
    })
    .sort((a, b) => b.battles - a.battles);

  return {
    stats,
    unmatched,
    unlabelled: chain.filter((c) => !labelledIds.has(c.battleId)).length,
    matched: labelled.length - unmatched,
  };
}

/** The commonest durations across everything, which is what showed the formats do not fix one. */
export function durationHistogram(
  chain: ChainBattle[],
  top = 6,
): Array<{ seconds: number; battles: number }> {
  const counts = new Map<number, number>();
  for (const c of chain) {
    const d = c.endTime - c.startTime;
    if (d <= 0) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([seconds, battles]) => ({ seconds, battles }))
    .sort((a, b) => b.battles - a.battles || a.seconds - b.seconds)
    .slice(0, top);
}
