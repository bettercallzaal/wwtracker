/**
 * PRD 35, 36 and 37: the portable fighter card, and the six dimensions a
 * ranking keeps apart.
 *
 * THE SPEC'S TWO WARNINGS ARE THE DESIGN. Section 37 ends "money and
 * competitive skill should not be collapsed into one metric" and section 38
 * ends "trading volume should not directly equal competitive ability; capital
 * should not be able to buy skill ranking." Read as prose those are cautions.
 * Read as requirements they forbid two specific things, and this module
 * enforces both.
 *
 * FIRST: THERE IS NO COMPOSITE SCORE AND THERE IS NO FUNCTION THAT PRODUCES
 * ONE. The six dimensions come back as six numbers. A caller who wants to rank
 * by one of them can; a caller who wants to add them together has to write that
 * themselves and will have to explain it. A weighted total is the exact thing
 * section 37 forbids, and the easiest thing in the world to add later "just for
 * the leaderboard".
 *
 * SECOND, AND IT IS THE ONE WITH TEETH: A RECORD IS BUILT FROM THE JUDGED
 * WINNER, NEVER THE SETTLEMENT WINNER. The program settles on the larger pool,
 * so a settlement-winner record is a record of who had more money behind them.
 * That is not an abstract risk here. Measured 2026-09-20 on this platform: one
 * artist is 35.8% of all buy volume, **31.4% of everything ever staked is that
 * artist buying his own side**, and 93% of his own-battle buying is on himself.
 *
 * A W-L built from settlement would let him buy his record directly. Built from
 * the judged result he wins 38 of 66, and the judges overrule his money exactly
 * as often as they back it - three and three. **The 2-of-3 rule is what makes
 * capital unable to buy the ranking, and using the wrong winner field throws
 * that away in one line.** So `resultWinner` is required and `settlementWinner`
 * is not accepted at all.
 *
 * COMPETITIVE RATING IS NULL, DELIBERATELY. Section 38 says "a future rating
 * model SHOULD be Elo/Glicko-like" and lists eight inputs. It describes
 * something nobody has built or decided. A plausible Elo here would be a number
 * with a decimal point and no mandate, and it would be adopted because it
 * looked official. Null with a reason, like every other undecided field in this
 * library.
 */

/** One battle as this module needs it. Judged result only. */
export interface RecordBattle {
  battleId: number;
  /** The JUDGED winner. Null when no result was recorded. */
  resultWinner: "artist_a" | "artist_b" | null;
  artistAWallet: string;
  artistBWallet: string;
  /** Which arena or platform ran it. PRD 35's per-arena breakdown. */
  arena: string;
  /** Total staked on the battle, in lamports. */
  volumeLamports: number;
  /** Distinct wallets that bought either side. */
  backers: string[];
  /** Whether this battle counts toward a ranked record. */
  ranked: boolean;
  /** Unix seconds, for the streak. */
  endTime: number;
}

/** PRD 37's six, kept apart on purpose. */
export interface RankingDimensions {
  competitiveRating: null;
  winLoss: { wins: number; losses: number; winRate: number | null };
  /** Money moved on this artist's battles. NOT a skill measure. */
  marketPower: number;
  battleVolumeLamports: number;
  /** Distinct backers. A crowd measure, not a money one. */
  communityStrength: number;
  /** Per-track records live in `buildTrackRecord`; this is the artist's. */
  trackRating: null;
}

export interface ArtistRecord {
  wallet: string;
  wins: number;
  losses: number;
  /** Positive for a win streak, negative for a loss streak, 0 for neither. */
  streak: number;
  rankedBattles: number;
  careerVolumeLamports: number;
  uniqueBackers: number;
  /** PRD 35's per-arena lines. */
  byArena: Array<{ arena: string; wins: number; losses: number }>;
  dimensions: RankingDimensions;
  /** Battles that had no judged result and were therefore not counted. */
  undecided: number;
  sources: Record<string, string>;
}

/** Thrown when a caller tries to build a record from settlement winners. */
export class SettlementWinnerRefused extends Error {
  constructor() {
    super(
      "a competitive record cannot be built from the settlement winner: the program " +
        "settles on the larger pool, so that is a record of who had more money behind " +
        "them. Pass the JUDGED winner (resultWinner). PRD 38: capital should not be " +
        "able to buy skill ranking.",
    );
    this.name = "SettlementWinnerRefused";
  }
}

const sideOf = (b: RecordBattle, wallet: string): "artist_a" | "artist_b" | null =>
  b.artistAWallet === wallet ? "artist_a" : b.artistBWallet === wallet ? "artist_b" : null;

export function buildArtistRecord(p: {
  wallet: string;
  battles: RecordBattle[];
  /**
   * A caller who has only settlement winners must say so, and is refused. The
   * flag exists so the refusal is explicit rather than a silently wrong record.
   */
  winnersAreSettlement?: boolean;
}): ArtistRecord {
  if (p.winnersAreSettlement) throw new SettlementWinnerRefused();

  const mine = p.battles.filter((b) => sideOf(b, p.wallet) !== null);
  const decided = mine.filter((b) => b.resultWinner !== null);
  const ranked = decided.filter((b) => b.ranked);

  let wins = 0;
  let losses = 0;
  const arena = new Map<string, { wins: number; losses: number }>();
  for (const b of ranked) {
    const won = b.resultWinner === sideOf(b, p.wallet);
    won ? (wins += 1) : (losses += 1);
    const a = arena.get(b.arena) ?? { wins: 0, losses: 0 };
    won ? (a.wins += 1) : (a.losses += 1);
    arena.set(b.arena, a);
  }

  // Streak runs backwards from the most recent ranked battle and stops at the
  // first result that breaks it. Undecided battles are skipped rather than
  // counted as losses - "no result recorded" is not a defeat.
  const byTime = [...ranked].sort((x, y) => y.endTime - x.endTime);
  let streak = 0;
  for (const b of byTime) {
    const won = b.resultWinner === sideOf(b, p.wallet);
    if (streak === 0) streak = won ? 1 : -1;
    else if (won && streak > 0) streak += 1;
    else if (!won && streak < 0) streak -= 1;
    else break;
  }

  const backers = new Set<string>();
  for (const b of mine) for (const t of b.backers) backers.add(t);
  const volume = mine.reduce((n, b) => n + b.volumeLamports, 0);

  return {
    wallet: p.wallet,
    wins,
    losses,
    streak,
    rankedBattles: ranked.length,
    careerVolumeLamports: volume,
    uniqueBackers: backers.size,
    byArena: [...arena.entries()]
      .map(([a, r]) => ({ arena: a, ...r }))
      .sort((x, y) => y.wins + y.losses - (x.wins + x.losses)),
    dimensions: {
      competitiveRating: null,
      winLoss: { wins, losses, winRate: wins + losses > 0 ? wins / (wins + losses) : null },
      marketPower: volume,
      battleVolumeLamports: volume,
      communityStrength: backers.size,
      trackRating: null,
    },
    undecided: mine.length - decided.length,
    sources: {
      wins: "judged result, counted over ranked battles only",
      streak: "judged results backwards from the most recent ranked battle; undecided battles skipped, not counted as losses",
      careerVolumeLamports: "supplied per battle; this library does not fetch trades",
      uniqueBackers: "distinct buying wallets supplied by the caller",
      competitiveRating:
        "PRD 38 describes a FUTURE Elo/Glicko-like model with eight inputs. None has been decided, so this is null rather than a plausible number that would be adopted because it looked official",
      trackRating: "per-track records are buildTrackRecord's job, not the artist's",
    },
  };
}

export interface TrackRecord {
  trackId: string;
  wins: number;
  losses: number;
  artistsDefeated: number;
  careerVolumeLamports: number;
  uniqueTraders: number;
  byArena: Array<{ arena: string; wins: number; losses: number }>;
}

/** PRD 36. Same rules: judged results, no composite. */
export function buildTrackRecord(p: {
  trackId: string;
  /** Battles this track appeared in, with which side it was on. */
  appearances: Array<{ battle: RecordBattle; side: "artist_a" | "artist_b" }>;
}): TrackRecord {
  let wins = 0;
  let losses = 0;
  const defeated = new Set<string>();
  const traders = new Set<string>();
  const arena = new Map<string, { wins: number; losses: number }>();
  let volume = 0;
  for (const { battle: b, side } of p.appearances) {
    volume += b.volumeLamports;
    for (const t of b.backers) traders.add(t);
    if (b.resultWinner === null) continue;
    const won = b.resultWinner === side;
    won ? (wins += 1) : (losses += 1);
    if (won) defeated.add(side === "artist_a" ? b.artistBWallet : b.artistAWallet);
    const a = arena.get(b.arena) ?? { wins: 0, losses: 0 };
    won ? (a.wins += 1) : (a.losses += 1);
    arena.set(b.arena, a);
  }
  return {
    trackId: p.trackId,
    wins,
    losses,
    artistsDefeated: defeated.size,
    careerVolumeLamports: volume,
    uniqueTraders: traders.size,
    byArena: [...arena.entries()].map(([a, r]) => ({ arena: a, ...r })),
  };
}

/**
 * The six dimensions, named, for a caller building a leaderboard.
 *
 * Returned as a list rather than a score so that a UI ranks by ONE of them and
 * says which. "Ranked by market power" is an honest column header; a composite
 * is a claim about how much a SOL is worth in wins, which nobody has made.
 */
export const RANKING_DIMENSIONS = [
  "competitiveRating",
  "winLoss",
  "marketPower",
  "battleVolumeLamports",
  "communityStrength",
  "trackRating",
] as const;
