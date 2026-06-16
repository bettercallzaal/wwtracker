// Single source of truth for the confirmed WaveWarZ artists on Audius.
// Used by Artists, Music, and the per-artist deep pages.

export interface RosterArtist {
  handle: string;
  audiusId: string;
  note: string;
}

export const ROSTER: RosterArtist[] = [
  { handle: "Hurric4n3Ike", audiusId: "lzq2G", note: "WaveWarZ founder & artist" },
  { handle: "GodclouD", audiusId: "Vg1rWzQ", note: '#1 song "Fuck yo feelingZ" (100 heat)' },
  { handle: "shawnsporter", audiusId: "E7gJo", note: "Tr4cks, Trippy, iF33L, Svnd4y" },
  { handle: "Stormbourne", audiusId: "Wgq5qO0", note: "Bad Decisions, Independent Girl" },
  { handle: "luiwrites", audiusId: "BJzwPMj", note: "Its a Mood, Rich Made, BUGS BUNNY" },
  { handle: "XTincT_official", audiusId: "8043XGp", note: "Ashes + demos" },
  { handle: "dopestilo", audiusId: "6aW9G", note: "Bonita (Latin)" },
  { handle: "CannonJones973", audiusId: "mEjV46v", note: "Money pose, Storm breaker" },
  { handle: "AporkALYPSE78", audiusId: "XBBWXMa", note: "The Decay, The Narrow Edge" },
  { handle: "geekmyth", audiusId: "zZR8pvZ", note: "Gimme a break brother, Locked In" },
  { handle: "PKMNCTO", audiusId: "ZOOMN24", note: '"Dead Already"' },
  { handle: "RoCkY2GriMeY", audiusId: "aNYwwmo", note: "High Frequency with PKMN" },
  { handle: "BennyJ504WaveWarz", audiusId: "RGyPJRg", note: '"What the: Unreleased"' },
  { handle: "TuckNuisance", audiusId: "AM1VdZq", note: '"I Know This Kid"' },
  { handle: "hoodrats", audiusId: "wQKydRp", note: '"Cipher Confession"' },
  { handle: "NDA_WaveWarz", audiusId: "oGZ6o3J", note: "WaveWarZ-tagged (NDA)" },
];

export const AUDIUS_ID_BY_HANDLE: Record<string, string> = Object.fromEntries(
  ROSTER.map((a) => [a.handle, a.audiusId]),
);

export const AUDIUS_HANDLES = new Set(ROSTER.map((a) => a.handle));
