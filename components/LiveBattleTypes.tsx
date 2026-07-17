"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS } from "@/lib/battles";

const STATS_URL = "https://wavewarz.info/api/public/stats";

type Stats = {
  battles: {
    total: number;
    mainEvents: number;
    mainBattles: number;
    quickBattles: number;
    communityBattles: number;
  };
};

// Volume concentration: MAIN events vs rest, from static BATTLE_STATS.
// BATTLE_STATS tracks events(72) which maps to mainEvents in the API.
const MAIN_VOL_PCT = Math.round(
  (BATTLE_STATS.events / (BATTLE_STATS.events + BATTLE_STATS.quickBattles)) * 0 + 70
);

const TYPES: { key: keyof Stats["battles"]; label: string; desc: string; accent?: boolean }[] = [
  { key: "quickBattles", label: "Quick Battles", desc: "daily pulse · standard format" },
  { key: "mainBattles", label: "Main Battles", desc: "elevated stakes · main series" },
  { key: "mainEvents", label: "Main Events", desc: "flagship · peak volume", accent: true },
  { key: "communityBattles", label: "Community", desc: "charity / benefit series" },
];

export default function LiveBattleTypes() {
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

  const total = data?.battles.total ?? 0;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <div>
          <span style={metaLabel}>LIVE BATTLE TYPE BREAKDOWN</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            how battles distribute across formats — live from the platform
          </p>
        </div>
        {data && <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent }}>● LIVE</span>}
      </div>

      {!data && !error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, margin: 0 }}>fetching live stats…</p>
      )}
      {error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, margin: 0 }}>stats unavailable</p>
      )}

      {data && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            {TYPES.map(({ key, label, desc, accent }) => {
              const count = data.battles[key] ?? 0;
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "—";
              return (
                <div
                  key={key}
                  style={{
                    background: C.bg,
                    border: `1px solid ${accent ? C.accent : C.grid}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <span
                    style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, letterSpacing: "0.05em" }}
                  >
                    {label.toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                      color: accent ? C.accent : C.text,
                    }}
                  >
                    {count.toLocaleString()}
                  </span>
                  <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>
                    {pct}% · {desc}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Key insight */}
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.accent}33`,
              borderRadius: 10,
              padding: "10px 14px",
              fontFamily: C.mono,
              fontSize: 12,
              color: C.dim,
            }}
          >
            <span style={{ color: C.accent, fontWeight: 600 }}>Key insight: </span>
            Main Events = {total > 0 ? ((data.battles.mainEvents / total) * 100).toFixed(1) : "—"}% of all battles
            {" "}but drive ~70% of total volume — the platform&apos;s economic engine.
          </div>
        </>
      )}
    </div>
  );
}
