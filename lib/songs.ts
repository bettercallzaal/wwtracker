// Single source of truth for the WaveWarZ song chart (37 songs).
// From wavewarz.info/leaderboards/songs. Snapshot 2026-06-15.
// audiusTrack IDs verified 2026-07-16 via Audius API /v1/users/{id}/tracks.

export interface Song {
  rank: number;
  song: string;
  artist: string;
  genre: string;
  heat: number;
  record: string;
  winPct: number;
  vol: number;
  audiusTrack?: string;
}

export const SONGS: Song[] = [
  { rank: 1, song: "Fuck yo feelingZ", artist: "GodclouD", genre: "Electronic", heat: 100, record: "4W-0L", winPct: 100, vol: 1.98, audiusTrack: "0X6BQ99" },
  { rank: 2, song: "What the: Unreleased", artist: "BennyJ504WaveWarz", genre: "Hip-Hop/Rap", heat: 56, record: "0W-1L", winPct: 0, vol: 0.247, audiusTrack: "dY4Q23y" },
  { rank: 3, song: "EAZE OF MIND", artist: "GodclouD", genre: "Hip-Hop/Rap", heat: 38, record: "2W-0L", winPct: 100, vol: 0.31, audiusTrack: "mE6RMV5" },
  { rank: 4, song: "High Frequency with PKMN", artist: "RoCkY2GriMeY", genre: "R&B/Soul", heat: 33, record: "0W-1L", winPct: 0, vol: 0.022, audiusTrack: "mWpBmxQ" },
  { rank: 5, song: "ACCELERATE", artist: "_0xQuan", genre: "Hip-Hop/Rap", heat: 28, record: "0W-1L", winPct: 0, vol: 0.005 },
  { rank: 6, song: "Tr4cks", artist: "shawnsporter", genre: "Metal", heat: 23, record: "1W-0L", winPct: 100, vol: 0.296, audiusTrack: "REKE0Vj" },
  { rank: 7, song: "Trippy", artist: "shawnsporter", genre: "Electronic", heat: 23, record: "0W-1L", winPct: 0, vol: 0.0001 },
  { rank: 8, song: "Ride the Wave Warz", artist: "_0xQuan", genre: "Hip-Hop/Rap", heat: 20, record: "2W-0L", winPct: 100, vol: 0.254, audiusTrack: "O67E5aQ" },
  { rank: 9, song: "Independent Girl", artist: "Stormbourne", genre: "Country", heat: 16, record: "0W-2L", winPct: 0, vol: 0.057, audiusTrack: "3RY7YP0" },
  { rank: 10, song: "GM (Galactic Memories)", artist: "_0xQuan", genre: "Hip-Hop/Rap", heat: 15, record: "0W-1L", winPct: 0, vol: 0.008, audiusTrack: "dlo60g5" },
  { rank: 11, song: "Gimme a break brother", artist: "geekmyth", genre: "Hip-Hop/Rap", heat: 12, record: "1W-1L", winPct: 50, vol: 0.153, audiusTrack: "bov1KX" },
  { rank: 12, song: "Money pose - Taji Kamikaze", artist: "CannonJones973", genre: "Hip-Hop/Rap", heat: 9, record: "0W-1L", winPct: 0, vol: 0.0001, audiusTrack: "Jov55z" },
  { rank: 13, song: "Svnd4y", artist: "shawnsporter", genre: "Metal", heat: 9, record: "0W-1L", winPct: 0, vol: 0.0098, audiusTrack: "lpo5P7b" },
  { rank: 14, song: "Repeating (Hardcore Break Mix)", artist: "shawnsporter", genre: "Drum & Bass", heat: 9, record: "1W-0L", winPct: 100, vol: 0.0493, audiusTrack: "b9QaR7b" },
  { rank: 15, song: "I Know This Kid", artist: "TuckNuisance", genre: "Hip-Hop/Rap", heat: 5, record: "0W-1L", winPct: 0, vol: 0.0098, audiusTrack: "dYVyrXv" },
  { rank: 16, song: "The Decay (Greasy Thoughts II)", artist: "AporkALYPSE78", genre: "Hip-Hop/Rap", heat: 5, record: "0W-1L", winPct: 0, vol: 0.0098, audiusTrack: "Rx4pgRw" },
  { rank: 17, song: "Ashes", artist: "XTincT_official", genre: "Alternative", heat: 5, record: "1W-0L", winPct: 100, vol: 0.0197, audiusTrack: "y69A2jZ" },
  { rank: 18, song: "Bad Decisions", artist: "Stormbourne", genre: "Rock", heat: 5, record: "2W-0L", winPct: 100, vol: 0.0394 },
  { rank: 19, song: "Make Them Pay Freestyle", artist: "RoCkY2GriMeY", genre: "Hip-Hop/Rap", heat: 4, record: "0W-1L", winPct: 0, vol: 0.0493, audiusTrack: "4kY69z4" },
  { rank: 20, song: "Locked In", artist: "geekmyth", genre: "Hip-Hop/Rap", heat: 3, record: "1W-0L", winPct: 100, vol: 0.0148, audiusTrack: "klRoJXp" },
  { rank: 21, song: "Bonita", artist: "dopestilo", genre: "Latin", heat: 3, record: "0W-1L", winPct: 0, vol: 0.0098, audiusTrack: "QR7pJzv" },
  { rank: 22, song: "iF33L", artist: "shawnsporter", genre: "Alternative", heat: 3, record: "1W-0L", winPct: 100, vol: 0.0673, audiusTrack: "p5mVM5B" },
  { rank: 23, song: "Dead Already", artist: "PKMNCTO", genre: "Hip-Hop/Rap", heat: 3, record: "0W-1L", winPct: 0, vol: 0.013, audiusTrack: "j48qp7j" },
  { rank: 24, song: "DownWavez x Hurric4n3Ike", artist: "Hurric4n3Ike", genre: "R&B/Soul", heat: 3, record: "1W-0L", winPct: 100, vol: 0.0197, audiusTrack: "d9oYgxK" },
  { rank: 25, song: "I'll Aim Guns At You", artist: "RoCkY2GriMeY", genre: "R&B/Soul", heat: 3, record: "0W-1L", winPct: 0, vol: 0.0049 },
  { rank: 26, song: "Its a Mood", artist: "luiwrites", genre: "Pop", heat: 3, record: "1W-1L", winPct: 50, vol: 0.0198, audiusTrack: "O5XYV1g" },
  { rank: 27, song: "I Don't Fit In", artist: "Stormbourne", genre: "Rock", heat: 2, record: "1W-0L", winPct: 100, vol: 0.0247, audiusTrack: "Xgv2Vvj" },
  { rank: 28, song: "Storm breaker - Taji Kamikaze", artist: "CannonJones973", genre: "Hip-Hop/Rap", heat: 2, record: "0W-1L", winPct: 0, vol: 0.0197, audiusTrack: "ANPO59v" },
  { rank: 29, song: "Islands", artist: "Stormbourne", genre: "Pop", heat: 2, record: "0W-1L", winPct: 0, vol: 0.0098, audiusTrack: "qpWl9JY" },
  { rank: 30, song: "Rich Made", artist: "luiwrites", genre: "Hip-Hop/Rap", heat: 1, record: "1W-0L", winPct: 100, vol: 0.0098 },
  { rank: 31, song: "AI LUI - Goated City", artist: "luiwrites", genre: "Acoustic", heat: 1, record: "0W-1L", winPct: 0, vol: 0.005, audiusTrack: "b4d0zYk" },
  { rank: 32, song: "dazedream_demov2", artist: "XTincT_official", genre: "Hip-Hop/Rap", heat: 1, record: "1W-1L", winPct: 50, vol: 0.0099, audiusTrack: "oEwx2AJ" },
  { rank: 33, song: "wondering_demov2", artist: "XTincT_official", genre: "Electronic", heat: 1, record: "1W-1L", winPct: 50, vol: 0.0053, audiusTrack: "KVoP2Mw" },
  { rank: 34, song: "I Got It", artist: "AporkALYPSE78", genre: "Hip-Hop/Rap", heat: 1, record: "0W-1L", winPct: 0, vol: 0.005 },
  { rank: 35, song: "The Narrow Edge", artist: "AporkALYPSE78", genre: "Hip-Hop/Rap", heat: 1, record: "1W-0L", winPct: 100, vol: 0.0098, audiusTrack: "bdBv3pO" },
  { rank: 36, song: "Cipher Confession (LUI/STILO Diss PT. 1)", artist: "hoodrats", genre: "Hip-Hop/Rap", heat: 0, record: "1W-1L", winPct: 50, vol: 0.0, audiusTrack: "Z4ogpyQ" },
  { rank: 37, song: "BUGS BUNNY", artist: "luiwrites", genre: "Hip-Hop/Rap", heat: 0, record: "1W-1L", winPct: 50, vol: 0.0004, audiusTrack: "dYW1JYm" },
];

export const songsByArtist = (handle: string) => SONGS.filter((s) => s.artist === handle);
