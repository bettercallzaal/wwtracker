"use client";

import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS as S, RECENT_BATTLES } from "@/lib/battles";

const fmt = (n: number, dp = 0) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function Battles() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / battles</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Every battle, all time. Two songs (or artist catalogs) go head-to-head;
          fans trade SOL on the winner. V2 judging: Poll + Charts + DJ Wavy, 2 of 3.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <Tile label="TOTAL BATTLES" value={fmt(S.totalShown)} sub="all time" />
        <Tile label="QUICK BATTLES" value={fmt(S.quickBattles)} sub="single song vs song" />
        <Tile label="MAIN EVENTS" value={fmt(S.events)} sub={`${S.multiRound} multi-round`} />
        <Tile label="TOTAL VOLUME" value={`${fmt(S.totalVolumeSol, 1)} ◎`} sub="SOL traded" />
        <Tile label="ARTIST PAYOUTS" value={`${fmt(S.artistPayoutsSol, 2)} ◎`} sub="to artists" />
        <Tile label="PLATFORM REVENUE" value={`${fmt(S.platformRevenueSol, 1)} ◎`} sub="fees + settlement" />
      </div>

      <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <span style={metaLabel}>RECENT BATTLES</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RECENT_BATTLES.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderTop: i ? `1px solid ${C.grid}` : "none", paddingTop: i ? 8 : 0 }}>
              <span style={{ fontFamily: C.mono, fontSize: 10, color: b.type === "MAIN" ? C.accent : C.dim, minWidth: 44 }}>{b.type}</span>
              <span style={{ flex: 1, minWidth: 180, fontSize: 14 }}>
                {b.a} <span style={{ color: C.dim }}>vs</span> {b.b}
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 12, color: C.good }}>{b.winner} won</span>
              <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>{fmt(b.vol, 3)} ◎ - {b.date}</span>
            </div>
          ))}
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
          A recent sample. The full per-battle feed (with pools + payout
          breakdowns) lives at{" "}
          <a href="https://wavewarz.info/battles" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
            wavewarz.info/battles &#8599;
          </a>{" "}
          - it&apos;s a virtualized list that doesn&apos;t fully export cleanly, so
          the aggregate stats above are exact and the feed links out.
        </p>
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}
