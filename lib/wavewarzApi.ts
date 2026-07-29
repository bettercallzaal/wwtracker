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

export interface BattleSummary {
  battleId: number;
  type: "main" | "quick" | "community";
  live: boolean;
  winnerDecided: boolean;
  winnerSide: "artist1" | "artist2" | null;
  artist1: BattleArtist;
  artist2: BattleArtist;
  factors: { pollWinner: string | null; djWavyWinner: string | null; djWavyReasoning: string | null };
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
  poolSol: { artist1: number; artist2: number };
  volumeSol: { artist1: number; artist2: number };
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
// /leaderboards/artists
// ---------------------------------------------------------------------------

export interface ArtistLeaderboardEntry {
  wallet: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  totalVolumeSol: number;
  totalVolumeUsd: number;
  totalEarningsSol: number;
  totalEarningsUsd: number;
  winRate: number;
  battles: number;
  pfpUrl: string | null;
  twitterHandle: string | null;
}

export function getArtistLeaderboard(limit = 100): Promise<ArtistLeaderboardEntry[]> {
  return getJson<ArtistLeaderboardEntry[]>(`/leaderboards/artists?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// /leaderboards/traders
// ---------------------------------------------------------------------------

export interface TraderLeaderboardEntry {
  wallet: string;
  totalVolumeSol: number;
  totalVolumeSolFmt: string;
  totalVolumeUsd: number;
  tradeCount: number;
  battleCount: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnlSol: number;
  netPnlFmt: string;
  netPnlUsd: number;
  netPnlPositive: boolean;
}

export function getTraderLeaderboard(limit = 100): Promise<TraderLeaderboardEntry[]> {
  return getJson<TraderLeaderboardEntry[]>(`/leaderboards/traders?limit=${limit}`);
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

export function getSongLeaderboard(query: SongsQuery = {}): Promise<SongLeaderboardEntry[]> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.sort) params.set("sort", query.sort);
  const qs = params.toString();
  return getJson<SongLeaderboardEntry[]>(`/leaderboards/songs${qs ? `?${qs}` : ""}`);
}
