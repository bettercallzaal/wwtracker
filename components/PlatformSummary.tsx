"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";
import { ROSTER } from "@/lib/artists";
import { PROGRAM_ID } from "@/lib/config";

type Battle = { date?: string; a: string; b: string; aHandle?: string; bHandle?: string };
const battles = battlesRaw as Battle[];

const MONTH_IDX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};
const MONTH_NAME = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseDateMs(s: string): number | null {
  const m = s.match(/^(\w{3}) \d{1,2}, (\d{4})$/);
  if (!m) return null;
  const mo = MONTH_IDX[m[1]];
  return mo !== undefined ? Date.UTC(parseInt(m[2]), mo, 1) : null;
}

function monthLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTH_NAME[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
}

export default function PlatformSummary() {
  const stats = useMemo(() => {
    const songs = new Set<string>();
    const pairMap = new Map<string, number>();
    const dateMsArr: number[] = [];

    for (const b of battles) {
      if (b.a) songs.add(b.a.trim());
      if (b.b) songs.add(b.b.trim());

      if (b.date) {
        const ms = parseDateMs(b.date);
        if (ms !== null) dateMsArr.push(ms);
      }

      const aH = b.aHandle;
      const bH = b.bHandle;
      if (aH && bH && aH !== bH) {
        const [lo, hi] = aH < bH ? [aH, bH] : [bH, aH];
        pairMap.set(`${lo}|${hi}`, (pairMap.get(`${lo}|${hi}`) ?? 0) + 1);
      }
    }

    const rivalries = [...pairMap.values()].filter((v) => v >= 2).length;
    const firstMs = dateMsArr.length ? Math.min(...dateMsArr) : 0;
    const lastMs = dateMsArr.length ? Math.max(...dateMsArr) : 0;

    const firstD = new Date(firstMs);
    const lastD = new Date(lastMs);
    const monthsActive =
      (lastD.getUTCFullYear() - firstD.getUTCFullYear()) * 12 +
      (lastD.getUTCMonth() - firstD.getUTCMonth()) + 1;

    return {
      totalBattles: battles.length,
      uniqueSongs: songs.size,
      artistRoster: ROSTER.length,
      rivalries,
      monthsActive,
      firstLabel: monthLabel(firstMs),
      lastLabel: monthLabel(lastMs),
    };
  }, []);

  const {
    totalBattles, uniqueSongs, artistRoster, rivalries, monthsActive, firstLabel, lastLabel,
  } = stats;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>PLATFORM SNAPSHOT</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          {firstLabel} → {lastLabel} · {monthsActive} months · Solana
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        <Tile label="BATTLES" value={totalBattles.toLocaleString()} sub="on-chain" amber />
        <Tile label="UNIQUE SONGS" value={uniqueSongs.toLocaleString()} sub="in the arena" />
        <Tile label="AUDIUS ARTISTS" value={String(artistRoster)} sub="rostered" />
        <Tile label="ARTIST RIVALRIES" value={String(rivalries)} sub="2+ battle series" />
        <Tile label="CHARITY RAISED" value="$1,497" sub="benefit battles" />
        <Tile label="MONTHS ACTIVE" value={String(monthsActive)} sub={`${firstLabel} → ${lastLabel}`} />
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 12, lineHeight: 1.6, color: C.dim }}>
        Program{" "}
        <a
          href={`https://solscan.io/account/${PROGRAM_ID}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: C.accent, textDecoration: "none", fontFamily: C.mono }}
        >
          {PROGRAM_ID.slice(0, 6)}…{PROGRAM_ID.slice(-4)}
        </a>
        {" "}on Solana. Battles + songs + rivalries from{" "}
        <a
          href="https://github.com/bettercallzaal/wwtracker"
          target="_blank"
          rel="noreferrer"
          style={{ color: C.accent, textDecoration: "none" }}
        >
          wwtracker
        </a>
        . Charity figure verified via ZAO OS doc 1214.
      </p>
    </div>
  );
}

function Tile({ label, value, sub, amber }: { label: string; value: string; sub: string; amber?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: amber ? C.accent : C.text }}>
        {value}
      </span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}
