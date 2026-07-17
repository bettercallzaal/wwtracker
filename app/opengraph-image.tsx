import { ImageResponse } from "next/og";
import { WW } from "@/lib/wwData";

export const runtime = "edge";
export const alt = "WaveWarZ on-chain tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fmt = (n: number) => n.toLocaleString("en-US");

export default function OG() {
  const p = WW.program;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #190f24, #2b1c3f)",
          padding: 72,
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, color: "#ffc24b", letterSpacing: "-2px" }}>
            WaveWarZ
          </div>
          <div style={{ fontSize: 34, color: "#a596b8", marginTop: 8 }}>
            on-chain tracker
          </div>
        </div>
        <div style={{ display: "flex", gap: 56 }}>
          <Stat label="BATTLES" value={fmt(p.battlesCreated)} />
          <Stat label="TRADES" value={fmt(p.buys + p.sells)} />
          <Stat label="TRADERS" value={fmt(p.uniqueTraders)} />
          <Stat label="BUY VOLUME" value={`${fmt(Math.round(WW.volume.total))} SOL`} />
        </div>
        <div style={{ fontSize: 24, color: "#a596b8" }}>
          wwtracker.vercel.app · Solana music-battle platform · The ZAO ecosystem
        </div>
      </div>
    ),
    size,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 22, color: "#a596b8" }}>{label}</div>
      <div style={{ fontSize: 52, fontWeight: 700, color: "#f4ecff" }}>{value}</div>
    </div>
  );
}
