// Artist and track identity, separated - because the public API does not
// separate them and its field names actively mislead.
//
// THE TRAP. In a battle payload, `artist1.name` is the TRACK TITLE, not the
// artist. Measured across 120 battles: 174 distinct values in that field
// against only 34 distinct wallets. "Sun" is a song by GodclouD. "WaveWarZ,
// the electric vibez" is a song by bettercallzaal. Anything rendering that
// field as an artist name is printing song titles where people expect names.
//
// THE IDENTITY. The wallet is the artist. It is on chain in every battle
// account (offsets 36 and 68, verified across 40 battles), it is immutable,
// and across the same 120-battle sample no wallet mapped to more than one
// Audius handle - a clean 1:1. That makes it a canonical artist id that works
// today, retroactively, with no new infrastructure.
//
// The readable name lives in the musicLink path: audius.co/<handle>/<track>.

export interface ArtistIdentity {
  /** Canonical. On chain, immutable, present in every battle this artist fought. */
  wallet: string;
  /** Audius handle, from the music link. Null when the link is missing or foreign. */
  handle: string | null;
  /** What to actually show a person. */
  displayName: string;
}

export interface TrackIdentity {
  /** The API's `name` field, which is the track title despite the field name. */
  title: string;
  /** URL slug, stable per track on Audius. */
  slug: string | null;
  url: string | null;
}

export interface BattleEntry {
  artist: ArtistIdentity;
  track: TrackIdentity;
}

interface RawEntry {
  name?: unknown;
  wallet?: unknown;
  musicLink?: unknown;
  twitterHandle?: unknown;
}

/** Audius links only. A link to anywhere else tells us nothing about identity. */
export function parseMusicLink(link: unknown): { handle: string; slug: string } | null {
  if (typeof link !== "string") return null;
  const m = link.match(/^https?:\/\/audius\.co\/([^/?#]+)\/([^?#]+)/i);
  if (!m) return null;
  const handle = m[1].trim();
  const slug = m[2].replace(/\/+$/, "").trim();
  return handle && slug ? { handle, slug } : null;
}

export function shortWallet(w: string): string {
  return w.length > 10 ? `${w.slice(0, 4)}...${w.slice(-4)}` : w;
}

/**
 * Split one side of a battle into who competed and what they entered.
 *
 * Returns null without a wallet: there is no identity to speak of, and
 * inventing one from a track title is how two artists get merged.
 */
export function parseEntry(raw: unknown): BattleEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as RawEntry;
  const wallet = typeof e.wallet === "string" ? e.wallet.trim() : "";
  if (!wallet) return null;

  const link = parseMusicLink(e.musicLink);
  const title = typeof e.name === "string" && e.name.trim() ? e.name.trim() : "Untitled";
  const twitter = typeof e.twitterHandle === "string" && e.twitterHandle.trim()
    ? e.twitterHandle.trim() : null;

  return {
    artist: {
      wallet,
      handle: link?.handle ?? null,
      // Prefer the Audius handle, then X, then the wallet. Never the track
      // title - that is the mistake this module exists to prevent.
      displayName: link?.handle ?? twitter ?? shortWallet(wallet),
    },
    track: {
      title,
      slug: link?.slug ?? null,
      url: typeof e.musicLink === "string" ? e.musicLink : null,
    },
  };
}

/**
 * Group battle sides by wallet to build a roster.
 *
 * Keyed on wallet rather than name for the reason above: names are tracks, and
 * grouping by them would produce one "artist" per song.
 */
export function rosterFromEntries(entries: BattleEntry[]): Map<string, ArtistIdentity & { tracks: number }> {
  const out = new Map<string, ArtistIdentity & { tracks: number }>();
  const seenTracks = new Map<string, Set<string>>();
  for (const e of entries) {
    const key = e.artist.wallet;
    const tracks = seenTracks.get(key) ?? new Set<string>();
    tracks.add(e.track.slug ?? e.track.title);
    seenTracks.set(key, tracks);
    const prev = out.get(key);
    out.set(key, {
      ...e.artist,
      // A later entry may carry a handle where an earlier one did not.
      handle: prev?.handle ?? e.artist.handle,
      displayName: prev?.handle ? prev.displayName : e.artist.displayName,
      tracks: tracks.size,
    });
  }
  return out;
}
