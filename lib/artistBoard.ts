// What the /artist/[handle] stat tiles show, and what they say about it.
//
// The tiles read the platform's live leaderboard. When that fetch failed - or
// the artist was not matched on it - they fell back to LEADERBOARD, a
// 2026-06-15 snapshot, and rendered its rank, record, win rate, volume and
// earnings with NO label, as if current. They also showed the snapshot while
// the live fetch was still in flight. 48 public pages. Found 2026-09-11.
//
// The same inverted alarm as the treasury tile (#280): a failed read looked
// exactly like a healthy one. Now the snapshot is only shown when the live
// board has definitively not answered for this artist, and then with its date.

import { LEADERBOARD_AS_OF, type LbArtist } from "@/lib/leaderboard";

export interface LiveBoardRow {
  rank: number;
  wins: number;
  losses: number;
  winRate: number;
  totalVolumeSol: number | string;
  totalEarningsSol: number | string;
}

export type BoardState =
  | { kind: "loading" }
  | { kind: "live"; row: LiveBoardRow }
  | { kind: "snapshot"; reason: string };

export interface ArtistTiles {
  rank: string;
  rec: string;
  win: string;
  vol: string;
  earn: string;
  /** Shown under the tiles when the figures are not live. */
  note: string | null;
}

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function artistTiles(state: BoardState, lb: LbArtist): ArtistTiles {
  if (state.kind === "loading") {
    // Never the snapshot while the live answer is pending: a flash of old
    // figures is still old figures presented as current.
    return { rank: "", rec: "-", win: "-", vol: "-", earn: "-", note: null };
  }
  if (state.kind === "live") {
    const r = state.row;
    return {
      rank: `#${r.rank}`,
      rec: `${r.wins}W-${r.losses}L`,
      win: `${Math.round(r.winRate)}%`,
      vol: `${fmt(Number(r.totalVolumeSol))} ◎`,
      earn: `${fmt(Number(r.totalEarningsSol), 3)} ◎`,
      note: null,
    };
  }
  return {
    rank: `#${lb.rank} (${LEADERBOARD_AS_OF})`,
    rec: lb.rec,
    win: `${Math.round(lb.win)}%`,
    vol: `${fmt(lb.vol)} ◎`,
    earn: `${fmt(lb.earn, 3)} ◎`,
    note: `Record, win rate, volume and earnings are from the ${LEADERBOARD_AS_OF} snapshot - ${state.reason}.`,
  };
}
