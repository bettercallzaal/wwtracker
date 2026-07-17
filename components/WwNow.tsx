"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

const STATS_URL = "https://wavewarz.info/api/public/stats";

type Stats = {
  solPriceUsd: number;
  volume: { totalSol: number; totalUsd: number };
  liveBattle: { count: number; vol: number } | null;
  artistPayouts: { totalSol: number; totalUsd: number };
  battles: { total: number; mainEvents: number; quickBattles: number; communityBattles: number };
};

function fmt(n: number, dp = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function Tile({
  label, value, sub, highlight,
}: {
  label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${highlight ? C.accent : C.grid}`,
      borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginBottom: 4, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 700, color: highlight ? C.accent : C.text }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function WwNow() {
  const [data, setData] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(STATS_URL)
      .then((r) => r.json())
      .then((d: Stats) => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Render nothing while loading or on error — avoids a flash of empty space
  // above the fold in §01 before the fetch resolves.
  if (!data) return null;

  const { volume, liveBattle, artistPayouts, battles } = data;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={metaLabel}>THE PLATFORM, RIGHT NOW</span>
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent }}>● LIVE</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Tile
          label="BATTLES"
          value={battles.total.toLocaleString()}
          sub={`${battles.quickBattles} quick · ${battles.mainEvents} main`}
        />
        <Tile
          label="VOLUME"
          value={`${fmt(volume.totalSol)} ◎`}
          sub={`$${fmt(volume.totalUsd, 0)}`}
        />
        <Tile
          label="ARTIST PAYOUTS"
          value={`${fmt(artistPayouts.totalSol)} ◎`}
          sub="1% of every trade, instant onchain"
        />
        {liveBattle ? (
          <Tile
            label="LIVE NOW"
            value={`${liveBattle.count} battle${liveBattle.count !== 1 ? "s" : ""}`}
            sub={`${fmt(liveBattle.vol)} ◎ at stake`}
            highlight
          />
        ) : (
          <Tile
            label="BATTLE SCHEDULE"
            value="Mon – Fri"
            sub="8:30 PM EST · wavewarz.info"
          />
        )}
      </div>
    </div>
  );
}
