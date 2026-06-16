import { ImageResponse } from "next/og";
import { LEADERBOARD } from "@/lib/leaderboard";
import { songsByArtist } from "@/lib/songs";
import { AUDIUS_ID_BY_HANDLE } from "@/lib/artists";

export const alt = "WaveWarZ artist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG({ params }: { params: { handle: string } }) {
  const handle = decodeURIComponent(params.handle || "");
  const canon = Object.keys(AUDIUS_ID_BY_HANDLE).find((h) => h.toLowerCase() === handle.toLowerCase()) || handle;
  const lb = LEADERBOARD.find((a) => a.handle.toLowerCase() === handle.toLowerCase());
  const songs = songsByArtist(canon);
  const topSong = [...songs].sort((a, b) => b.heat - a.heat)[0];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(135deg, #190f24, #2b1c3f)", padding: 72, fontFamily: "monospace" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: "#a596b8", letterSpacing: 2 }}>WAVEWARZ ARTIST</div>
          <div style={{ fontSize: 86, fontWeight: 800, color: "#ffc24b", letterSpacing: "-2px", marginTop: 6 }}>@{canon}</div>
          {lb && <div style={{ fontSize: 34, color: "#f4ecff", marginTop: 10 }}>Leaderboard #{lb.rank} - {lb.rec} - {lb.win}% win</div>}
        </div>
        <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
          {lb && <Stat label="VOLUME" value={`${Math.round(lb.vol)} SOL`} />}
          {lb && <Stat label="EARNINGS" value={`${lb.earn.toFixed(2)} SOL`} />}
          <Stat label="CHARTING SONGS" value={`${songs.length}`} />
          {topSong && <Stat label="TOP SONG" value={topSong.song.slice(0, 22)} />}
        </div>
        <div style={{ fontSize: 24, color: "#a596b8" }}>wwtracker.vercel.app</div>
      </div>
    ),
    size,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 20, color: "#a596b8" }}>{label}</div>
      <div style={{ fontSize: 46, fontWeight: 700, color: "#f4ecff" }}>{value}</div>
    </div>
  );
}
