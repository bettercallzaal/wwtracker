// Choosing and shaping the battle a widget should show. Pure, so the selection
// rule is testable without network - it is the part that decides what a viewer
// on someone else's site sees.
//
// NOTE ON NAMES. The API's `artist1.name` is the TRACK TITLE, not the artist.
// See lib/artistIdentity.ts. This module carries both, separately, because the
// first version of the widget rendered the track title where the artist name
// belonged.

export interface RawArtist {
  /** The API calls this the artist name. It is the track title. */
  name?: string;
  poolSol?: number;
  volumeSol?: number;
  albumArtUrl?: string | null;
  wallet?: string;
  musicLink?: string;
  twitterHandle?: string | null;
}

export interface RawBattle {
  battleId?: number | string;
  type?: string;
  live?: boolean;
  winnerDecided?: boolean;
  winnerSide?: string | null;
  artist1?: RawArtist;
  artist2?: RawArtist;
  createdAt?: string;
  endsAt?: string;
  url?: string;
  factors?: {
    pollVotesArtist1?: number;
    pollVotesArtist2?: number;
    djWavyWinner?: string | null;
  } | null;
}

export interface RawBattlesResponse {
  battles?: RawBattle[];
}

export interface BattleSide {
  /** The track entered. This is what the API calls `name`. */
  track: string;
  /** Who entered it. Audius handle where known, else a shortened wallet. */
  artist: string;
  poolSol: number;
  art: string | null;
}

export interface WidgetBattle {
  id: string;
  live: boolean;
  settled: boolean;
  type: string;
  endsAt: string | null;
  url: string;
  winnerSide: "artist1" | "artist2" | null;
  a: BattleSide;
  b: BattleSide;
  poll: { a: number; b: number } | null;
  djWavy: string | null;
}

import { parseEntry, shortWallet } from "./artistIdentity";

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function shape(b: RawBattle): WidgetBattle | null {
  const id = b.battleId != null ? String(b.battleId) : "";
  if (!id) return null;
  const a1 = b.artist1 ?? {};
  const a2 = b.artist2 ?? {};
  const winner = b.winnerSide === "artist1" || b.winnerSide === "artist2" ? b.winnerSide : null;
  const ea = parseEntry(a1);
  const eb = parseEntry(a2);
  const side = (raw: RawArtist, parsed: ReturnType<typeof parseEntry>, fallback: string): BattleSide => ({
    track: parsed?.track.title ?? raw.name ?? fallback,
    artist: parsed?.artist.displayName ?? (raw.twitterHandle ? String(raw.twitterHandle) : "unknown artist"),
    poolSol: num(raw.poolSol),
    art: raw.albumArtUrl ?? null,
  });

  return {
    id,
    live: b.live === true,
    settled: b.winnerDecided === true,
    type: typeof b.type === "string" ? b.type : "battle",
    endsAt: typeof b.endsAt === "string" ? b.endsAt : null,
    url: typeof b.url === "string" ? b.url : `https://wavewarz.info/battles/${id}`,
    winnerSide: winner,
    a: side(a1, ea, "Entry 1"),
    b: side(a2, eb, "Entry 2"),
    poll: b.factors
      ? { a: num(b.factors.pollVotesArtist1), b: num(b.factors.pollVotesArtist2) }
      : null,
    djWavy: b.factors?.djWavyWinner ?? null,
  };
}

/**
 * A live battle beats a finished one, however recent the finished one is.
 *
 * The list arrives newest-first, and a battle that just settled sorts above one
 * still running. Taking [0] would show an arena's visitors a finished battle
 * while a live one was happening on the same platform - the single worst thing
 * this widget could do.
 */
export function pickBattle(res: RawBattlesResponse): WidgetBattle | null {
  const rows = Array.isArray(res.battles) ? res.battles : [];
  const live = rows.find((b) => b.live === true);
  const chosen = live ?? rows[0];
  return chosen ? shape(chosen) : null;
}

/** Whole seconds until `endsAt`, floored at 0. Null when there is no end time. */
export function secondsLeft(endsAt: string | null, now: number): number | null {
  if (!endsAt) return null;
  const t = Date.parse(endsAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((t - now) / 1000));
}

/** Share of the combined pool on side A, 0-1. Half when nothing is staked. */
export function poolShare(a: number, b: number): number {
  const total = a + b;
  return total <= 0 ? 0.5 : a / total;
}
