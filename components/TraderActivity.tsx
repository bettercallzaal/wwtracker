"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

const STATS_URL = "https://wavewarz.info/api/public/stats";

type Stats = {
  solPriceUsd: number;
  volume: { totalSol: number; last24hSol: number; last7dSol: number };
  traderClaims: { totalSol: number; totalUsd: number; withdrawalCount: number };
};

function fmt(n: number, dp = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginBottom: 4, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 20, fontWeight: 700, color: C.text }}>{value}</div>
      {sub && <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function TraderActivity() {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(STATS_URL)
      .then((r) => r.json())
      .then((d: Stats) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  const claims = data?.traderClaims;
  const vol = data?.volume;
  const solUsd = data?.solPriceUsd ?? 0;
  const avgClaim = claims && claims.withdrawalCount > 0
    ? claims.totalSol / claims.withdrawalCount
    : 0;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={metaLabel}>TRADING PULSE</span>
        {data && <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent }}>● LIVE</span>}
      </div>

      {!data && !error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>fetching live stats…</p>
      )}
      {error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>stats unavailable</p>
      )}
      {data && claims && vol && (
        <>
          {/* Hero */}
          <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
            <div style={{ fontFamily: C.mono, fontSize: 48, fontWeight: 800, color: C.accent, lineHeight: 1 }}>
              {fmt(claims.totalSol)} ◎
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, marginTop: 8 }}>
              total claimed by winning traders — {claims.withdrawalCount.toLocaleString()} successful withdrawals
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <Tile
              label="LAST 24H VOLUME"
              value={`${fmt(vol.last24hSol)} ◎`}
              sub={`$${fmt(vol.last24hSol * solUsd, 0)}`}
            />
            <Tile
              label="LAST 7D VOLUME"
              value={`${fmt(vol.last7dSol)} ◎`}
              sub={`$${fmt(vol.last7dSol * solUsd, 0)}`}
            />
            <Tile
              label="AVG CLAIM SIZE"
              value={`${fmt(avgClaim, 3)} ◎`}
              sub={`$${fmt(avgClaim * solUsd, 2)} per withdrawal`}
            />
            <Tile
              label="TOTAL PAID OUT"
              value={`$${fmt(claims.totalUsd, 0)}`}
              sub={`${fmt(claims.totalSol)} SOL lifetime`}
            />
          </div>

          <p style={{ marginTop: 14, fontFamily: C.mono, fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
            Trader claims are real withdrawals (claimShares), parsed from on-chain vault transactions.
            Only winning-side positions are claimable. Volume figures are buy-side only.
          </p>
        </>
      )}
    </div>
  );
}
