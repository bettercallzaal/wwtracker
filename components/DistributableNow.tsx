"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { FLOOR_SOL, RECIPIENTS } from "@/lib/distributions";

const STATS_URL = "https://wavewarz.info/api/public/stats";

type Stats = {
  solPriceUsd: number;
  platformRevenue: { totalSol: number; totalUsd: number };
  volume: { last7dSol: number };
};

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function DistributableNow() {
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

  const revenue = data?.platformRevenue.totalSol ?? 0;
  const solUsd = data?.solPriceUsd ?? 0;
  const buffer = Math.max(0, revenue - FLOOR_SOL);
  const bufferUsd = buffer * solUsd;
  const isAboveFloor = revenue > FLOOR_SOL;

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.grid}`,
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span style={metaLabel}>DISTRIBUTABLE NOW</span>
          <p style={{ margin: "6px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12, lineHeight: 1.5, maxWidth: 480 }}>
            Live platform revenue minus the {FLOOR_SOL}&nbsp;◎ operating floor. If a distribution ran today, this is what each recipient would receive.
          </p>
        </div>
        {data && (
          <span style={{ fontFamily: C.mono, fontSize: 11, color: C.accent }}>● LIVE</span>
        )}
      </div>

      {!data && !error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, margin: 0 }}>fetching live stats…</p>
      )}
      {error && (
        <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, margin: 0 }}>stats unavailable</p>
      )}

      {data && (
        <>
          {/* Revenue vs floor */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            <MetricTile
              label="LIVE REVENUE"
              value={`${fmt(revenue)} ◎`}
              sub={`$${fmt(revenue * solUsd, 0)} USD`}
            />
            <MetricTile
              label="OPERATING FLOOR"
              value={`${FLOOR_SOL} ◎`}
              sub="held in reserve"
              dim
            />
            <MetricTile
              label="DISTRIBUTABLE BUFFER"
              value={isAboveFloor ? `${fmt(buffer)} ◎` : "below floor"}
              sub={isAboveFloor ? `$${fmt(bufferUsd, 0)} USD` : `${fmt(FLOOR_SOL - revenue, 2)} ◎ short`}
              accent={isAboveFloor}
            />
          </div>

          {/* Per-recipient breakdown */}
          {isAboveFloor && (
            <div>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: 10,
                  color: C.dim,
                  letterSpacing: "0.06em",
                  display: "block",
                  marginBottom: 10,
                }}
              >
                IF DISTRIBUTED NOW — {fmt(buffer, 3)}&nbsp;◎ AT {fmt(revenue, 2)}&nbsp;◎ REVENUE
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 10,
                }}
              >
                {RECIPIENTS.map((r) => {
                  const share = (buffer * r.percent) / 100;
                  return (
                    <div
                      key={r.name}
                      style={{
                        background: C.bg,
                        border: `1px solid ${C.grid}`,
                        borderRadius: 10,
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 10, letterSpacing: "0.04em" }}>
                        {r.percent}%
                      </span>
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                          color: C.text,
                        }}
                      >
                        {fmt(share, 3)}&nbsp;◎
                      </span>
                      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{r.name}</span>
                      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 10 }}>
                        ${fmt(share * solUsd, 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isAboveFloor && (
            <p style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, margin: 0 }}>
              Revenue is currently below the {FLOOR_SOL}&nbsp;◎ floor — no amount is distributable yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  accent,
  dim,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${accent ? C.accent : C.grid}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, letterSpacing: "0.06em" }}>{label}</span>
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: accent ? C.accent : dim ? C.dim : C.text,
        }}
      >
        {value}
      </span>
      {sub && <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>}
    </div>
  );
}
