"use client";

import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS as S } from "@/lib/battles";
import { usd } from "@/lib/price";

// ZAO Vitals — a one-glance snapshot of The ZAO as a DAO case study.
// Numbers sourced from: live stats API (battles/volume/payouts), verified
// research (charity $1,497), and The ZAO's public governance record (Fractals).
export default function ZaoVitals() {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>THE ZAO — DAO VITALS</span>
        <p style={{ margin: "6px 0 0", color: C.text, lineHeight: 1.6, fontSize: 14, maxWidth: 680 }}>
          The ZAO (ZTalent Artist Organization) is the DAO that incubated WaveWarZ.
          These are the live metrics that make it a documented case study in onchain
          community governance and music-IP creation.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Tile label="FRACTAL WEEKS" value="100+" sub="consecutive governance cycles" />
        <Tile label="WW BATTLES" value={S.totalShown.toLocaleString()} sub="on WaveWarZ since launch" />
        <Tile label="TOTAL VOLUME" value={`${S.totalVolumeSol.toFixed(0)} ◎`} sub={usd(S.totalVolumeSol)} />
        <Tile label="ARTIST PAYOUTS" value={`${S.artistPayoutsSol.toFixed(2)} ◎`} sub={usd(S.artistPayoutsSol)} />
        <Tile label="CHARITY RAISED" value="~$1,497" sub="2 benefit battle series" />
        <Tile label="IRL EVENTS" value="2+" sub="ZAO-CHELLA + ZAOstock" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href="https://thezao.com" label="thezao.com" />
        <Link href="https://wavewarz.com" label="WaveWarZ" />
        <Link href="https://zaostock.com" label="ZAOstock Oct 3 2026" />
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
        Battles / volume / payouts: live from wavewarz.info/api/public/stats.
        Charity: PolyRaiders Holiday Heat (Dec 2024) + Love Song Benefit (Feb 2025),
        to HuRya Empowerment Foundation. Fractals: 100+ consecutive weekly governance
        cycles using the Respect game (same mechanism as Optimism). Source:
        thezao.com / ZAOOS public record.
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
        {value}
      </span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}

function Link({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        fontFamily: C.mono,
        fontSize: 12,
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${C.grid}`,
        background: C.bg,
        color: C.text,
        textDecoration: "none",
      }}
    >
      {label} &#8599;
    </a>
  );
}
