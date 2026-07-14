import type { StoredBattle, SpeakerLogEntry, RecapDraft } from "./types";
import { findLeaderboardEntry, findDayActivity } from "./context";
import type { LeaderboardEntry, DayActivityEntry } from "./context";

const TAG_LINE = "@WaveWarZ - wavewarz.com";

export interface RecapContext {
  leaderboard: LeaderboardEntry[];
  activity: DayActivityEntry[];
}

function battleName(handle: string | null, title: string): string {
  return handle ?? title;
}

function winnerSide(battle: StoredBattle): "a" | "b" | null {
  if (battle.winner === battle.a) return "a";
  if (battle.winner === battle.b) return "b";
  return null;
}

const NOT_INCLUDED_PAYOUT = "Per-battle artist payout: only the platform-aggregate figure exists (8.66 SOL total)";
const NOT_INCLUDED_TRADES = "Notable individual trades: no per-battle trade-level data available";

export function buildMainEventRecap(battle: StoredBattle, context: RecapContext): RecapDraft {
  const aName = battleName(battle.aHandle, battle.a);
  const bName = battleName(battle.bHandle, battle.b);
  const side = winnerSide(battle);
  const winnerName = side === "a" ? aName : side === "b" ? bName : battle.winner;
  const winnerHandle = side === "a" ? battle.aHandle : side === "b" ? battle.bHandle : null;
  const vol = battle.vol.toFixed(2);

  const dataUsed = [
    `Winner: ${winnerName} (source: public/ww-battles.json, battle_id ${battle.id})`,
    `Volume: ${vol} SOL (source: same)`,
  ];
  const board = findLeaderboardEntry(context.leaderboard, winnerHandle, winnerName);
  if (board) {
    dataUsed.push(`Artist standing: rank ${board.rank}, ${board.record} (source: lib/leaderboard.ts snapshot)`);
  }

  const farcaster = `Main Event: ${aName} vs ${bName} on WaveWarZ. ${winnerName} took the win in front of ${vol} SOL in the pool. ${TAG_LINE}`;
  const x = `Main Event: ${aName} vs ${bName}. ${winnerName} wins, ${vol} SOL in the pool. ${TAG_LINE}`;

  return { farcaster, x, dataUsed, notIncluded: [NOT_INCLUDED_PAYOUT, NOT_INCLUDED_TRADES] };
}

function formatMmSs(totalSec: number): string {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function buildShowRecap(
  showDate: string,
  battles: StoredBattle[],
  speakerLog: SpeakerLogEntry[] | null,
  context: RecapContext,
): RecapDraft {
  const totalVol = battles.reduce((sum, b) => sum + b.vol, 0);
  const dataUsed = [
    `Battles that night: ${battles.length} (source: public/ww-battles.json, date ${showDate})`,
    `Total volume: ${totalVol.toFixed(2)} SOL (source: same)`,
  ];

  const activity = findDayActivity(context.activity, showDate);
  if (activity) {
    dataUsed.push(
      `Platform activity that day: ${activity.buys} buys / ${activity.sells} sells / ${activity.claims} claims (source: public/ww-activity.json)`,
    );
  }

  const top = battles.slice().sort((a, b) => b.vol - a.vol)[0] ?? null;
  const topLine = top
    ? `${battleName(top.aHandle, top.a)} vs ${battleName(top.bHandle, top.b)} (${top.winner} won, ${top.vol.toFixed(2)} SOL)`
    : "no battles logged";

  let quoteSuffix = "";
  if (speakerLog) {
    const withCaption = speakerLog.find((e) => e.captionText);
    if (withCaption && withCaption.captionText) {
      const ts = formatMmSs(withCaption.timestampSec);
      quoteSuffix = ` ${withCaption.speaker}: "${withCaption.captionText}" (per space replay at ${ts}).`;
      dataUsed.push(`Stream quote: ${withCaption.speaker} at ${ts} (source: recaps/spaces speaker log)`);
    }
  }

  const farcaster = `WaveWarZ show recap - ${showDate}. ${battles.length} battles, ${totalVol.toFixed(2)} SOL total volume. Top: ${topLine}.${quoteSuffix} ${TAG_LINE}`;
  const x = `WaveWarZ ${showDate}: ${battles.length} battles, ${totalVol.toFixed(2)} SOL. Top: ${topLine}. ${TAG_LINE}`;

  return { farcaster, x, dataUsed, notIncluded: [NOT_INCLUDED_PAYOUT] };
}

export function buildWeeklyRecap(
  battles: StoredBattle[],
  weekStart: string,
  weekEnd: string,
  context: RecapContext,
): RecapDraft {
  void context; // reserved for future weekly-context use (e.g. week-over-week leaderboard once history exists)
  const totalVol = battles.reduce((sum, b) => sum + b.vol, 0);
  const topVolume = battles.slice().sort((a, b) => b.vol - a.vol)[0] ?? null;
  const withMargin = battles.filter((b): b is StoredBattle & { margin: number } => b.margin !== null);
  const closestMargin = withMargin.slice().sort((a, b) => a.margin - b.margin)[0] ?? null;

  const artistCounts = new Map<string, number>();
  for (const b of battles) {
    artistCounts.set(battleName(b.aHandle, b.a), (artistCounts.get(battleName(b.aHandle, b.a)) ?? 0) + 1);
    artistCounts.set(battleName(b.bHandle, b.b), (artistCounts.get(battleName(b.bHandle, b.b)) ?? 0) + 1);
  }
  const mostActive = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const dataUsed = [
    `Battles this week: ${battles.length} (source: public/ww-battles.json, ${weekStart} to ${weekEnd})`,
    `Total volume: ${totalVol.toFixed(2)} SOL (source: same)`,
  ];
  if (topVolume) {
    dataUsed.push(
      `Top-volume battle: ${battleName(topVolume.aHandle, topVolume.a)} vs ${battleName(topVolume.bHandle, topVolume.b)}, ${topVolume.vol.toFixed(2)} SOL (source: same, battle_id ${topVolume.id})`,
    );
  }
  if (closestMargin) {
    dataUsed.push(
      `Closest battle: ${battleName(closestMargin.aHandle, closestMargin.a)} vs ${battleName(closestMargin.bHandle, closestMargin.b)}, margin ${closestMargin.margin}% (source: same, battle_id ${closestMargin.id})`,
    );
  }
  if (mostActive) {
    dataUsed.push(`Most active artist: ${mostActive[0]}, ${mostActive[1]} battle(s) (source: same)`);
  }

  const farcaster = `WaveWarZ weekly recap, ${weekStart} to ${weekEnd}. ${battles.length} battles, ${totalVol.toFixed(2)} SOL total volume.${topVolume ? ` Biggest: ${battleName(topVolume.aHandle, topVolume.a)} vs ${battleName(topVolume.bHandle, topVolume.b)}.` : ""} ${TAG_LINE}`;
  const x = `WaveWarZ week of ${weekStart}: ${battles.length} battles, ${totalVol.toFixed(2)} SOL. ${TAG_LINE}`;

  return {
    farcaster,
    x,
    dataUsed,
    notIncluded: ["Leaderboard movement: no historical snapshot to diff against yet"],
  };
}

export function renderRecapMarkdown(
  kind: "show" | "main-event" | "weekly",
  title: string,
  date: string,
  draft: RecapDraft,
): string {
  const heading = kind === "show" ? "Show Recap" : kind === "main-event" ? "Main Event Recap" : "Weekly Recap";
  const lines = [
    `# ${heading} - ${title} - ${date}`,
    "",
    "## Draft - Farcaster",
    draft.farcaster,
    "",
    "## Draft - X",
    draft.x,
    "",
    "## Data used",
    ...draft.dataUsed.map((d) => `- ${d}`),
  ];
  if (draft.notIncluded.length > 0) {
    lines.push("", "## Not included (unverifiable at this granularity)", ...draft.notIncluded.map((d) => `- ${d}`));
  }
  return lines.join("\n") + "\n";
}
