"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS } from "@/lib/battles";
import { RECIPIENTS } from "@/lib/distributions";

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function EconomicsBreakdown() {
  const { platformRate, artistRate, impliedSplit } = useMemo(() => {
    const { totalVolumeSol, platformRevenueSol, artistPayoutsSol } = BATTLE_STATS;
    const platformRate = (platformRevenueSol / totalVolumeSol) * 100;
    const artistRate = (artistPayoutsSol / totalVolumeSol) * 100;
    const impliedSplit = RECIPIENTS.map((r) => ({
      name: r.name,
      percent: r.percent,
      sol: Math.round((platformRevenueSol * r.percent) / 100 * 1000) / 1000,
    }));
    return { platformRate, artistRate, impliedSplit };
  }, []);

  const { totalVolumeSol, platformRevenueSol, artistPayoutsSol } = BATTLE_STATS;

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.grid}`,
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div>
        <span style={metaLabel}>REVENUE FLOW</span>
        <p style={{ margin: "8px 0 0", color: C.dim, fontSize: 13, lineHeight: 1.6, maxWidth: 560 }}>
          Where the money goes — every battle generates platform revenue and direct
          artist payouts. Platform revenue accumulates in the treasury until it
          clears the 3.5&nbsp;SOL floor, then distributes per the split below.
        </p>
      </div>

      {/* three headline tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))",
          gap: 12,
        }}
      >
        <Tile
          label="TOTAL BUY VOLUME"
          value={`${fmt(totalVolumeSol, 2)} ◎`}
          sub="all battles, all time"
          accent={false}
        />
        <Tile
          label="PLATFORM REVENUE"
          value={`${fmt(platformRevenueSol, 2)} ◎`}
          sub={`${fmt(platformRate, 2)}% of buy volume`}
          accent
        />
        <Tile
          label="ARTIST PAYOUTS"
          value={`${fmt(artistPayoutsSol, 2)} ◎`}
          sub={`${fmt(artistRate, 2)}% of buy volume`}
          accent={false}
        />
      </div>

      {/* per-trade fee breakdown */}
      <div>
        <span style={{ ...metaLabel, fontSize: 10, marginBottom: 10, display: "block" }}>
          PER-BATTLE RATE BREAKDOWN
        </span>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
          <tbody>
            <Row k="Per trade → platform" v="0.5% of trade" />
            <Row k="Per trade → artist" v="1.0% of trade" />
            <Row k="Settlement → platform" v="3% of loser pool" />
            <Row k="Settlement → winning artist" v="5% of loser pool" />
            <Row k="Settlement → losing artist" v="2% of loser pool" />
          </tbody>
        </table>
      </div>

      {/* implied distribution at current revenue */}
      <div>
        <span style={{ ...metaLabel, fontSize: 10, marginBottom: 10, display: "block" }}>
          REVENUE SPLIT AT {fmt(platformRevenueSol, 2)}&nbsp;◎ ACCUMULATED
        </span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
          }}
        >
          {impliedSplit.map((r) => (
            <div
              key={r.name}
              style={{
                background: C.bg,
                border: `1px solid ${C.grid}`,
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 10 }}>{r.percent}%</span>
              <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {fmt(r.sol, 3)}&nbsp;◎
              </span>
              <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{r.name}</span>
            </div>
          ))}
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
          Implied split — what 33%/22%/22%/22% looks like at the current accumulated
          revenue total. Actual distribution events are tracked in the section above.
        </p>
      </div>

      <p style={{ ...metaLabel, fontSize: 11, margin: 0, lineHeight: 1.6 }}>
        Volume and revenue from wavewarz.info API, snapshot 2026-06-15. Buy volume
        counts both sides of all trades. Artist payouts = 1% per-trade + settlement
        share; platform revenue = 0.5% per-trade + 3% settlement.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: boolean;
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
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: accent ? C.accent : C.text,
        }}
      >
        {value}
      </span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr style={{ borderTop: `1px solid ${C.grid}` }}>
      <td style={{ padding: "8px 10px 8px 0", color: C.dim, fontSize: 13 }}>{k}</td>
      <td
        style={{
          padding: "8px 0",
          textAlign: "right",
          color: C.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v}
      </td>
    </tr>
  );
}
