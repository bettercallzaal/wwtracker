"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { FLOOR_SOL } from "@/lib/config";

const STATS_URL = "https://wavewarz.info/api/public/stats";

type Stats = {
  solPriceUsd: number;
  platformRevenue?: { totalSol: number; totalUsd: number };
  artistPayouts: { totalSol: number; totalUsd: number };
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

export default function RevenueFloor() {
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

  const revenue = data?.platformRevenue?.totalSol ?? 0;
  const payouts = data?.artistPayouts.totalSol ?? 0;
  const revenueUsd = data?.platformRevenue?.totalUsd ?? 0;
  const payoutsUsd = data?.artistPayouts.totalUsd ?? 0;
  const totalFees = revenue + payouts;
  const totalFeesUsd = revenueUsd + payoutsUsd;
  const ratio = revenue / FLOOR_SOL;

  // floor marker position: where FLOOR_SOL sits on [0, revenue] scale
  const floorPct = Math.min(95, (FLOOR_SOL / Math.max(revenue, FLOOR_SOL + 0.01)) * 100);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={metaLabel}>REVENUE VS. FLOOR</span>
        {data && <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent }}>● LIVE</span>}
      </div>

      {!data && !error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>fetching live stats…</p>
      )}
      {error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>
          stats unavailable — see platform analytics above
        </p>
      )}
      {data && (
        <>
          <div style={{ textAlign: "center", padding: "14px 0 22px" }}>
            <div style={{ fontFamily: C.mono, fontSize: 52, fontWeight: 800, color: C.accent, lineHeight: 1 }}>
              {fmt(ratio, 1)}×
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, marginTop: 8 }}>
              platform revenue above the {FLOOR_SOL} SOL operating floor
            </div>
          </div>

          {/* Bar: full width = total revenue earned; red marker = the floor */}
          <div style={{ marginBottom: 24, position: "relative", paddingTop: 20 }}>
            <div style={{ position: "absolute", top: 0, left: `${floorPct}%`, transform: "translateX(-50%)" }}>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.danger, whiteSpace: "nowrap" }}>
                {FLOOR_SOL} SOL floor
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: C.grid, position: "relative" }}>
              <div style={{
                height: 10, borderRadius: 5,
                background: `linear-gradient(90deg, ${C.accentDim} 0%, ${C.accent} 100%)`,
                width: "100%",
              }} />
              <div style={{
                position: "absolute", top: -4, bottom: -4,
                left: `${floorPct}%`, transform: "translateX(-50%)",
                width: 2, background: C.danger, borderRadius: 1,
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.dim }}>0 SOL</span>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.dim }}>{fmt(revenue, 2)} SOL</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            <Tile
              label="PLATFORM REVENUE"
              value={`${fmt(revenue)} ◎`}
              sub={`$${fmt(revenueUsd, 0)} · 3.16% take rate`}
            />
            <Tile
              label="ARTIST PAYOUTS"
              value={`${fmt(payouts)} ◎`}
              sub={`$${fmt(payoutsUsd, 0)} · 1.79% rate`}
            />
            <Tile
              label="TOTAL FEES GENERATED"
              value={`${fmt(totalFees)} ◎`}
              sub={`$${fmt(totalFeesUsd, 0)} combined`}
            />
          </div>

          <p style={{ marginTop: 14, fontFamily: C.mono, fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
            Revenue above the {FLOOR_SOL} SOL floor distributes: 33% operations · 22% each to Hurricane / Candy / Zaal.
            Artist payouts are instant and onchain — separate from the platform share.
          </p>
        </>
      )}
    </div>
  );
}
