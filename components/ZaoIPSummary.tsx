"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";
import { ROSTER } from "@/lib/artists";

type Battle = { a: string; b: string; aHandle?: string; bHandle?: string };
const battles = battlesRaw as Battle[];

export default function ZaoIPSummary() {
  const { uniqueSongs, rivalryPairs } = useMemo(() => {
    const songs = new Set<string>();
    const pairMap = new Map<string, number>();

    for (const b of battles) {
      if (b.a) songs.add(b.a.trim());
      if (b.b) songs.add(b.b.trim());

      const aH = b.aHandle;
      const bH = b.bHandle;
      if (aH && bH && aH !== bH) {
        const [lo, hi] = aH < bH ? [aH, bH] : [bH, aH];
        pairMap.set(`${lo}|${hi}`, (pairMap.get(`${lo}|${hi}`) ?? 0) + 1);
      }
    }

    return {
      uniqueSongs: songs.size,
      rivalryPairs: [...pairMap.values()].filter((v) => v >= 2).length,
    };
  }, []);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>ZAO IP — CREATIVE CATALOG</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          the music and artists that make up ZAO&apos;s onchain IP
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Tile label="UNIQUE SONGS" value={uniqueSongs.toLocaleString()} sub="across all battles" />
        <Tile label="AUDIUS ARTISTS" value={String(ROSTER.length)} sub="rostered · verified" />
        <Tile label="ARTIST RIVALRIES" value={String(rivalryPairs)} sub="2+ battle series" />
        <Tile label="ARTIST INTERVIEWS" value="2" sub="XTinct · Kata7yst" />
      </div>

      <p style={{ margin: "0 0 10px", color: C.text, lineHeight: 1.6, fontSize: 14 }}>
        Every battle in WaveWarZ is fought over original music — tracks created
        by independent artists and published on{" "}
        <a
          href="https://audius.co/WaveWarZ"
          target="_blank"
          rel="noreferrer"
          style={{ color: C.accent, textDecoration: "none" }}
        >
          Audius
        </a>
        . The arena has become a proving ground for ZAO&apos;s artist roster:
        head-to-head rivalries, verified win records, and SOL-backed fan support.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <BulletRow>
          <b>GodclouD</b> — headliner rivalry, 8–0 undefeated record
        </BulletRow>
        <BulletRow>
          <b>CannonJones973</b> — 6 series battles, 4–2 record
        </BulletRow>
        <BulletRow>
          <b>Kata7yst, XTinct</b> — featured in verified artist interviews
        </BulletRow>
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
        Citable: {uniqueSongs.toLocaleString()} unique songs · {ROSTER.length} Audius artists ·{" "}
        {rivalryPairs} rivalry pairs · 2 artist interviews · $1,497 charity raised.
        All verified on-chain or via oEmbed. Source: ZAO OS doc 1214.
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}

function BulletRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: C.text, fontFamily: C.mono, fontSize: 13, lineHeight: 1.5 }}>
      <span style={{ color: C.accent, marginRight: 8 }}>•</span>
      {children}
    </div>
  );
}
