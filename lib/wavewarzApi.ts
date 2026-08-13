// Typed client for WaveWarZ's own public API (https://wavewarz.info/api-docs).
// No key, no auth, CORS open - safe to call directly from the client. The
// server caches responses 30-60s, so callers shouldn't poll faster than that.
//
// This is real-time, first-party data straight from WaveWarZ - a better
// source than Dune for anything it covers (it updates instantly; Dune is a
// snapshot refreshed on demand) and it covers things Dune's free tier can't
// reach at all (per-battle artist earnings - previously deferred in
// docs/ARCHITECTURE.md §9 as needing paid-tier joins or RPC account decode).

const BASE = "https://wavewarz.info/api/public";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`WaveWarZ API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// /stats
// ---------------------------------------------------------------------------

export interface PublicStats {
  updatedAt: string;
  solPriceUsd: number;
  volume: { totalSol: number; totalUsd: number; last24hSol: number; last7dSol: number };
  /** Non-null when a battle is currently live - shape not fully confirmed (only seen null in testing), treat as opaque/truthy-check only. */
  liveBattle: unknown;
  artistPayouts: { totalSol: number; totalUsd: number; note: string };
  traderClaims: { totalSol: number; totalUsd: number; withdrawalCount: number; note: string };
  platformRevenue?: { totalSol: number; totalUsd: number };
  battles: {
    total: number;
    mainEvents: number;
    mainBattles: number;
    quickBattles: number;
    communityBattles: number;
  };
}

export function getPublicStats(): Promise<PublicStats> {
  return getJson<PublicStats>("/stats");
}

// ---------------------------------------------------------------------------
// /battles, /battles/:id
// ---------------------------------------------------------------------------

export interface BattleArtist {
  name: string;
  wallet: string;
  musicLink: string | null;
  profilePictureUrl: string | null;
  twitterHandle: string | null;
  albumArtUrl: string | null;
  poolSol: number;
  volumeSol: number;
}

// `factors` is polymorphic - the API returns a different shape per battle type,
// verified live 2026-08-12:
//
//   quick / community -> pollWinner, pollVotesArtist1, pollVotesArtist2,
//                        djWavyWinner, djWavyReasoning
//   main             -> humanJudgeWinner, xPollWinner, solVoteWinner, judgedAt
//
// This mirrors the two judging systems: Quick Battles settle on a poll plus DJ
// Wavy (an AI judge - its reasoning text refers to "Track A"/"Track B" and is
// machine-written), while Main Events settle on the three-point system of human
// judge, X poll, and SOL vote.
//
// Every field is optional because none of them are present on both shapes.
// Reading `factors.pollWinner` on a Main Event yields undefined, so callers must
// handle both - see `pollWinnerOf` below.
export interface BattleFactors {
  /** Quick/community only. */
  pollWinner?: string | null;
  pollVotesArtist1?: number | null;
  pollVotesArtist2?: number | null;
  djWavyWinner?: string | null;
  djWavyReasoning?: string | null;
  /** Main only. */
  humanJudgeWinner?: string | null;
  xPollWinner?: string | null;
  solVoteWinner?: string | null;
  judgedAt?: string | null;
}

/**
 * The audience-poll verdict for a battle, whichever shape it arrived in.
 * Quick/community battles carry `pollWinner`; Main Events carry `xPollWinner`.
 * Returns null when this battle has no poll verdict - never a silent default.
 */
export function pollWinnerOf(factors: BattleFactors | null | undefined): "artist1" | "artist2" | null {
  const raw = factors?.pollWinner ?? factors?.xPollWinner ?? null;
  return raw === "artist1" || raw === "artist2" ? raw : null;
}

export interface BattleSummary {
  battleId: number;
  type: "main" | "quick" | "community";
  live: boolean;
  winnerDecided: boolean;
  winnerSide: "artist1" | "artist2" | null;
  artist1: BattleArtist;
  artist2: BattleArtist;
  factors: BattleFactors;
  imageUrl: string | null;
  createdAt: string;
  endsAt: string;
  url: string;
}

export interface BattlesResponse {
  updatedAt: string;
  count: number;
  battles: BattleSummary[];
}

export interface BattlesQuery {
  type?: "main" | "quick" | "community";
  live?: boolean;
  limit?: number;
  offset?: number;
}

export function getPublicBattles(query: BattlesQuery = {}): Promise<BattlesResponse> {
  const params = new URLSearchParams();
  if (query.type) params.set("type", query.type);
  if (query.live !== undefined) params.set("live", String(query.live));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  return getJson<BattlesResponse>(`/battles${qs ? `?${qs}` : ""}`);
}

export interface ArtistEarnings {
  artist1: { tradingFeesSol: number; settlementBonusSol: number; totalSol: number };
  artist2: { tradingFeesSol: number; settlementBonusSol: number; totalSol: number };
}

export interface BattleDetail extends Omit<BattleSummary, "artist1" | "artist2"> {
  artist1: BattleArtist;
  artist2: BattleArtist;
  artistEarnings: ArtistEarnings;
  battleDurationSeconds: number | null;
  streamLink: string | null;
}

export function getPublicBattleById(battleId: number | string): Promise<BattleDetail> {
  return getJson<BattleDetail>(`/battles/${battleId}`);
}

// ---------------------------------------------------------------------------
// /events (Main Events, grouped by best-of-3 rounds)
// ---------------------------------------------------------------------------

export interface EventRound {
  battleId: number;
  roundNumber: number;
  winnerSide: "artist1" | "artist2" | null;
  // Flat, not nested - verified against the live endpoint 2026-08-12. An earlier
  // nested `poolSol: { artist1, artist2 }` shape was never what the API returns.
  artist1PoolSol: number;
  artist2PoolSol: number;
  artist1VolumeSol: number;
  artist2VolumeSol: number;
  createdAt: string;
  endsAt: string;
  live: boolean;
  humanJudgeWinner: string | null;
  xPollWinner: string | null;
  solVoteWinner: string | null;
  judgedAt: string | null;
  url: string;
}

export interface EventSummary {
  eventId: number;
  eventSubtype: "standard" | "charity" | "spotlight" | "prediction";
  live: boolean;
  artist1: { name: string; wallet: string; profilePictureUrl: string | null; twitterHandle: string | null };
  artist2: { name: string; wallet: string; profilePictureUrl: string | null; twitterHandle: string | null };
  roundsWon: { artist1: number; artist2: number };
  winnerSide: "artist1" | "artist2" | null;
  totalVolumeSol: number;
  imageUrl: string | null;
  startedAt: string;
  endsAt: string | null;
  rounds: EventRound[];
}

export interface EventsResponse {
  updatedAt: string;
  count: number;
  events: EventSummary[];
}

export interface EventsQuery {
  subtype?: "standard" | "charity" | "spotlight" | "prediction";
  live?: boolean;
  limit?: number;
}

export function getPublicEvents(query: EventsQuery = {}): Promise<EventsResponse> {
  const params = new URLSearchParams();
  if (query.subtype) params.set("subtype", query.subtype);
  if (query.live !== undefined) params.set("live", String(query.live));
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();
  return getJson<EventsResponse>(`/events${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Leaderboards
//
// All three leaderboard endpoints return a WRAPPED object, not a bare array -
// verified live 2026-08-13:
//
//   /leaderboards/artists -> { updatedAt, count, artists: [...] }
//   /leaderboards/traders -> { updatedAt, solPriceUsd, count, traders: [...] }
//   /leaderboards/songs   -> { updatedAt, count, songs: [...] }
//
// These were previously typed as bare arrays, so calling .map() on the result
// would have thrown at runtime. Nothing consumed them yet, which is why it went
// unnoticed - it would have failed the moment the leaderboard pages were wired
// to live data.
//
// Some numeric fields also arrive as strings: the artists endpoint sends
// totalVolumeSol as "300.7357", and every *Usd field on every endpoint is a
// pre-formatted display string like "$22,879.97". Use solNum() before doing
// arithmetic on anything SOL-denominated.
// ---------------------------------------------------------------------------

/**
 * Coerce a SOL amount that may arrive as a number or a numeric string.
 * Returns null for anything unparseable rather than 0 - a missing value must
 * never render as a real zero.
 */
export function solNum(v: number | string | null | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    // Number("") and Number("   ") are both 0, which would turn a missing value
    // into a real-looking zero. Reject empty input before parsing.
    const cleaned = v.replace(/[$,\s]/g, "");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// /leaderboards/artists
// ---------------------------------------------------------------------------

export interface ArtistLeaderboardEntry {
  wallet: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  /** Numeric string on this endpoint, e.g. "300.7357". Use `solNum()`. */
  totalVolumeSol: number | string;
  /** Pre-formatted for display, e.g. "$22,879.97". Not arithmetic-safe. */
  totalVolumeUsd: string;
  /** Numeric string. Use `solNum()`. */
  totalEarningsSol: number | string;
  /** Pre-formatted for display. */
  totalEarningsUsd: string;
  winRate: number;
  battles: number;
  pfpUrl: string | null;
  twitterHandle: string | null;
}

export interface ArtistLeaderboardResponse {
  updatedAt: string;
  count: number;
  artists: ArtistLeaderboardEntry[];
}

/** Returns the entries. Use `getArtistLeaderboardResponse` if you need `updatedAt`. */
export async function getArtistLeaderboard(limit = 100): Promise<ArtistLeaderboardEntry[]> {
  return (await getArtistLeaderboardResponse(limit)).artists ?? [];
}

export function getArtistLeaderboardResponse(limit = 100): Promise<ArtistLeaderboardResponse> {
  return getJson<ArtistLeaderboardResponse>(`/leaderboards/artists?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// /leaderboards/traders
// ---------------------------------------------------------------------------

export interface TraderLeaderboardEntry {
  wallet: string;
  totalVolumeSol: number;
  totalVolumeSolFmt: string;
  /** Pre-formatted for display, e.g. "$1,701.18". Not arithmetic-safe. */
  totalVolumeUsd: string;
  tradeCount: number;
  battleCount: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnlSol: number;
  netPnlFmt: string;
  /** Pre-formatted for display. Not arithmetic-safe. */
  netPnlUsd: string;
  netPnlPositive: boolean;
}

export interface TraderLeaderboardResponse {
  updatedAt: string;
  solPriceUsd: number;
  count: number;
  traders: TraderLeaderboardEntry[];
}

export async function getTraderLeaderboard(limit = 100): Promise<TraderLeaderboardEntry[]> {
  return (await getTraderLeaderboardResponse(limit)).traders ?? [];
}

export function getTraderLeaderboardResponse(limit = 100): Promise<TraderLeaderboardResponse> {
  return getJson<TraderLeaderboardResponse>(`/leaderboards/traders?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// /leaderboards/songs
// ---------------------------------------------------------------------------

export interface SongLeaderboardEntry {
  songTitle: string;
  artistName: string;
  musicLink: string | null;
  genre: string | null;
  artUrl: string | null;
  battles: number;
  wins: number;
  losses: number;
  winRate: number;
  totalVolumeSol: number;
  totalUniqueTraders: number;
  lastPlayed: string | null;
}

export interface SongsQuery {
  limit?: number;
  sort?: "volume" | "battles" | "winRate";
}

export interface SongLeaderboardResponse {
  updatedAt: string;
  count: number;
  songs: SongLeaderboardEntry[];
}

export async function getSongLeaderboard(query: SongsQuery = {}): Promise<SongLeaderboardEntry[]> {
  return (await getSongLeaderboardResponse(query)).songs ?? [];
}

export function getSongLeaderboardResponse(query: SongsQuery = {}): Promise<SongLeaderboardResponse> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.sort) params.set("sort", query.sort);
  const qs = params.toString();
  return getJson<SongLeaderboardResponse>(`/leaderboards/songs${qs ? `?${qs}` : ""}`);
}
