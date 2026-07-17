"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

const STATS_URL = "https://wavewarz.info/api/public/stats";

type StatsResponse = {
  updatedAt: string;
  solPriceUsd: number;
  volume: { sol: number; usd: number };
  liveBattle: { count: number; vol: number } | null;
  artistPayouts: { sol: number; usd: number };
  traderClaims: { sol: number; usd: number; withdrawalCount: number };
  platformRevenue: { sol: number; usd: number };
  battles: { total: number; quick: number; mainEvent: number; community: number };
};

export default function LivePlatformStats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(STATS_URL)
      .then((r) => r.json())
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setError(true); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const fmt = (n: number, dp = 2) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={metaLabel}>LIVE PLATFORM STATS</span>
        {!loading && !error && (
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent }}>● LIVE</span>
        )}
      </div>

      {loading && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>fetching live stats…</p>
      )}
      {error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>stats unavailable — see baked data above</p>
      )}
      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <Tile label="TOTAL VOLUME" value={`${fmt(data.volume.sol)} ◎`} sub={`$${fmt(data.volume.usd, 0)}`} />
            <Tile label="BATTLES" value={data.battles.total.toLocaleString()} sub={`${data.battles.quick} quick · ${data.battles.mainEvent} main`} />
            <Tile label="ARTIST PAYOUTS" value={`${fmt(data.artistPayouts.sol)} ◎`} sub={`$${fmt(data.artistPayouts.usd, 0)}`} />
            <Tile label="PLATFORM REVENUE" value={`${fmt(data.platformRevenue.sol)} ◎`} sub={`$${fmt(data.platformRevenue.usd, 0)}`} />
            <Tile label="TRADER CLAIMS" value={`${fmt(data.traderClaims.sol)} ◎`} sub={`${data.traderClaims.withdrawalCount} withdrawals`} />
            {data.liveBattle && (
              <Tile label="LIVE NOW" value={`${data.liveBattle.count} battle${data.liveBattle.count !== 1 ? "s" : ""}`} sub={`${fmt(data.liveBattle.vol)} ◎ at stake`} accent />
            )}
          </div>
          <p style={{ margin: "12px 0 0", fontFamily: C.mono, fontSize: 11, color: C.dim }}>
            wavewarz.info/api/public/stats · updated {new Date(data.updatedAt).toLocaleTimeString()} · SOL ${fmt(data.solPriceUsd, 2)}
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${accent ? C.accent : C.grid}`, borderRadius: 10, padding: "10px 12px" }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums", color: accent ? C.accent : C.text }}>
        {value}
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
