/**
 * The 45-second window, measured: how long after a battle opens on chain does
 * the room hear it, and did a trade land inside that gap.
 *
 * Zaal's ruling, 2026-09-21 (decisions/grill-2026-09-21-seat-morning-5.md,
 * item 5): "lets test first startone and see if we can trade before wavewarz
 * 45 second delay". Three clocks per battle:
 *   - chain open: the account's start_time (exact).
 *   - the room: a mark Zaal typed the moment the host announced the round
 *     (scripts/ww-mark.sh, stamped by this machine's clock), later replaced by
 *     the Space transcript's time.
 *   - trades: the watcher's samples, one per trade landing (poolHistory).
 *
 * Pure. The script feeds it the marks file, the store and the accounts.
 */
import type { PoolSample } from "./poolHistory";

export interface Mark {
  /** Unix seconds. */
  t: number;
  /** The word typed: announce, sent, or anything else. */
  label: string;
  raw: string;
}

/** One line of the marker log: `2026-09-21T21:02:14-0400 announce`. */
export function parseMarkLine(line: string): Mark | null {
  const m = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4})\s+(.*)$/);
  if (!m) return null;
  const iso = m[1].replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const raw = m[2].trim();
  return { t: Math.floor(t / 1000), label: raw.split(/\s+/)[0]?.toLowerCase() ?? "", raw };
}

export function parseMarks(text: string): Mark[] {
  return text.split("\n").map(parseMarkLine).filter((m): m is Mark => m !== null);
}

/**
 * WHICH BATTLES A REPORT SHOULD COVER, decided by the marks rather than by the
 * clock.
 *
 * The 45-second report used a hardcoded "touched in the last 6 h". A session
 * runs at night and the report gets run the next morning, which is when
 * somebody has time - and then the window is empty, the report says "nothing
 * to report", and the marks that were typed during the session are never used.
 * The marks ARE the session, so they define the window: from the first mark to
 * the last, padded by an hour each way to catch a battle that opened before
 * anyone started typing and closed after they stopped.
 *
 * Returns null when there are no marks, and the caller falls back to a clock
 * window and says which it used.
 */
export function windowFromMarks(marks: Mark[], padSeconds = 3600): { fromMs: number; toMs: number } | null {
  if (marks.length === 0) return null;
  let first = marks[0].t, last = marks[0].t;
  for (const m of marks) {
    if (m.t < first) first = m.t;
    if (m.t > last) last = m.t;
  }
  return { fromMs: (first - padSeconds) * 1000, toMs: (last + padSeconds) * 1000 };
}

export interface BattleWindow {
  battleId: number;
  /** Chain open and close, unix seconds, from the account. */
  startTime: number;
  endTime: number;
  /** The first "announce" mark inside the battle, or null. */
  announceT: number | null;
  /** Every "sent" mark inside the battle. */
  sentT: number[];
  /** Trades that landed before the announce mark (or all trades when there is no mark). */
  tradesBeforeAnnounce: number;
  tradesTotal: number;
  /** First trade landing, unix seconds, or null when none. */
  firstTradeT: number | null;
  /** announceT - startTime, seconds; null without a mark. */
  lagSeconds: number | null;
  /** For each sent mark: seconds after chain open, and whether it preceded the announce mark. */
  sends: Array<{ t: number; afterOpen: number; beforeAnnounce: boolean | null }>;
}

/**
 * Marks and samples belong to a battle when they fall between its chain open
 * (minus a minute of slack, for a mark typed on the beat before the watcher
 * saw the account) and its chain close.
 */
export function battleWindow(
  battleId: number,
  account: { startTime: number; endTime: number },
  marks: Mark[],
  samples: PoolSample[],
): BattleWindow {
  const lo = account.startTime - 60;
  const hi = account.endTime;
  const inside = marks.filter((m) => m.t >= lo && m.t <= hi);
  const announce = inside.find((m) => m.label === "announce")?.t ?? null;
  const sent = inside.filter((m) => m.label === "sent").map((m) => m.t);
  const trades = samples.filter((s) => s.t >= account.startTime && s.t <= hi).map((s) => s.t).sort((a, b) => a - b);
  const before = announce === null ? trades.length : trades.filter((t) => t < announce).length;
  return {
    battleId,
    startTime: account.startTime,
    endTime: account.endTime,
    announceT: announce,
    sentT: sent,
    tradesBeforeAnnounce: before,
    tradesTotal: trades.length,
    firstTradeT: trades[0] ?? null,
    lagSeconds: announce === null ? null : announce - account.startTime,
    sends: sent.map((t) => ({
      t,
      afterOpen: t - account.startTime,
      beforeAnnounce: announce === null ? null : t < announce,
    })),
  };
}

/** One battle as lines a person reads, with the unknowns named. */
export function describeWindow(w: BattleWindow): string[] {
  const out = [`battle ${w.battleId}: chain open ${w.startTime}, close ${w.endTime} (${w.endTime - w.startTime}s)`];
  out.push(
    w.announceT === null
      ? "  announce mark: NONE inside this battle, so the lag is UNKNOWN for it"
      : `  announce mark: ${w.lagSeconds}s after chain open`,
  );
  out.push(`  trades: ${w.tradesTotal} recorded` + (w.firstTradeT !== null ? `, first ${w.firstTradeT - w.startTime}s after open` : ""));
  if (w.announceT !== null) out.push(`  trades before the announce mark: ${w.tradesBeforeAnnounce} of ${w.tradesTotal}`);
  if (w.sends.length === 0) out.push("  sent marks: none (no trade of ours marked in this battle)");
  for (const s of w.sends) {
    out.push(
      `  sent mark: ${s.afterOpen}s after open` +
        (s.beforeAnnounce === null ? " (no announce mark to compare)" : s.beforeAnnounce ? ", BEFORE the announcement" : ", after the announcement"),
    );
  }
  return out;
}
