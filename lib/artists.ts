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
  // Added from the official wavewarz.info roster (every Audius artist linked on
  // the site, resolved to live Audius IDs). 2026-06-16.
  { handle: "bettercallzaal", audiusId: "xQYZWyj", note: "BetterCallZaal - ZAO head of ecosystem" },
  { handle: "_0xQuan", audiusId: "7O66BZ7", note: "0xQUAN - Ride the Wave WarZ, accelerate" },
  { handle: "ace1yoda", audiusId: "vYZmbGm", note: "One Yoda" },
  { handle: "DCoopOfficial", audiusId: "8a8vv", note: "DCoop" },
  { handle: "GESD1", audiusId: "rbR8RRG", note: "Gesd1" },
  { handle: "ItsMoneyMiller", audiusId: "vJ1lyRz", note: "Money Miller" },
  { handle: "Kata7yst", audiusId: "G2wYPPx", note: "Kata7yst" },
  { handle: "MetaVerseSlim", audiusId: "AAN58Vg", note: "DeCentralized Sounds" },
  { handle: "NemesisLadyRyn", audiusId: "1AykB73", note: "Nemesis vs Ladyryn" },
  { handle: "NFTWonderfull", audiusId: "AAXN3", note: "ItzWonderfull" },
  { handle: "ozthecryptogoat", audiusId: "YZy8zOJ", note: "ozthecryptogoat" },
  { handle: "Retrospect", audiusId: "rAZ6JN", note: "Retrospect" },
  { handle: "Sicariobaby", audiusId: "wGmVJRk", note: "Sicario Baby" },
  { handle: "srchappell", audiusId: "WQOwMz9", note: "srchappell" },
  { handle: "sweetbiddi", audiusId: "1jAZg9W", note: "SweetBiddiMcGee" },
  { handle: "zKeyz", audiusId: "dMg3E5", note: "Production is the bag!" },
  { handle: "BennyJ504", audiusId: "bVgyk", note: "BennyJ504 - main account" },
  { handle: "frameworkfortune", audiusId: "AMNd4pg", note: "ENTERLUDE (0W-1L on wavewarz.info, 2026-07)" },
];

export const AUDIUS_ID_BY_HANDLE: Record<string, string> = Object.fromEntries(
  ROSTER.map((a) => [a.handle, a.audiusId]),
);

export const AUDIUS_HANDLES = new Set(ROSTER.map((a) => a.handle));

// Maps leaderboard X/Twitter handle → Audius handle for artists where they differ.
export const X_TO_AUDIUS_HANDLE: Record<string, string> = {
  therealgodcloud:   "GodclouD",
  GeEkMyTh_ETH:     "geekmyth",
  cannonjones973:    "CannonJones973",
  Stormiunleashed:   "Stormbourne",
  XTincT_io:        "XTincT_official",
  kata7yst:          "Kata7yst",
  bennyj504:         "BennyJ504",
  "RoCkY2GriMeY__": "RoCkY2GriMeY",
};

// Reverse: Audius handle → leaderboard X handle.
export const AUDIUS_TO_X_HANDLE: Record<string, string> = Object.fromEntries(
  Object.entries(X_TO_AUDIUS_HANDLE).map(([x, a]) => [a, x]),
);
