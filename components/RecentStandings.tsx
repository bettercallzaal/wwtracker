"use client";

import { useEffect, useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

interface Battle {
  type: string;
  date: string;
  a: string;
  b: string;
  winner: string;
  vol: number;
  aHandle?: string;
  bHandle?: string;
}

interface Stat {
  handle: string;
  battles: number;
  wins: number;
  vol: number;
}

const WINDOW_DAYS = 30;

function parseDate(s: string): Date | null {
  // "Jul 14, 2026" or "July 14, 2026"
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

type SortKey = "battles" | "wins" | "vol" | "winPct";

export default function RecentStandings() {
  const [battles, setBattles] = useState<Battle[] | null>(null);
  const [sort, setSort] = useState<SortKey>("battles");

  useEffect(() => {
    let alive = true;
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((d: Battle[]) => alive && setBattles(d))
      .catch(() => alive && setBattles([]));
    return () => { alive = false; };
  }, []);

  const { stats, dateRange } = useMemo(() => {
    if (!battles) return { stats: [], dateRange: "" };

    // Find the most recent battle date in the data
    let latest: Date | null = null;
    for (const b of battles) {
      const d = parseDate(b.date);
      if (d && (!latest || d > latest)) latest = d;
    }
    if (!latest) return { stats: [], dateRange: "" };

    const cutoff = new Date(latest.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const map = new Map<string, Stat>();

    for (const b of battles) {
      const ah = b.aHandle?.toLowerCase().trim();
      const bh = b.bHandle?.toLowerCase().trim();
      if (!ah || !bh || ah === bh) continue;
      const d = parseDate(b.date);
      if (!d || d < cutoff) continue;

      const aWon = b.winner?.trim() === b.a?.trim();
      const vol = b.vol ?? 0;
      for (const [h, won] of [[ah, aWon], [bh, !aWon]] as [string, boolean][]) {
        const s = map.get(h) ?? { handle: h, battles: 0, wins: 0, vol: 0 };
        s.battles += 1;
        if (won) s.wins += 1;
        s.vol += vol;
        map.set(h, s);
      }
    }

    const cutoffStr = cutoff.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const latestStr = latest.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return {
      stats: Array.from(map.values()),
      dateRange: `${cutoffStr} – ${latestStr}`,
    };
  }, [battles]);

  const sorted = useMemo(() => {
    const comparator: Record<SortKey, (a: Stat, b: Stat) => number> = {
      battles: (a, b) => b.battles - a.battles,
      wins: (a, b) => b.wins - a.wins,
      vol: (a, b) => b.vol - a.vol,
      winPct: (a, b) => (b.wins / b.battles) - (a.wins / a.battles),
    };
    return [...stats].sort(comparator[sort]);
  }, [stats, sort]);

  if (!battles) return <div className="skeleton-shimmer" style={{ height: 200, borderRadius: 14 }} />;
  if (!sorted.length) return null;

  const totalBattles = sorted.reduce((s, x) => s + x.battles, 0) / 2; // each battle counted for 2 handles

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => setSort(k)}
      style={{
        fontFamily: C.mono,
        fontSize: 11,
        padding: "4px 10px",
        borderRadius: 6,
        cursor: "pointer",
        border: `1px solid ${sort === k ? C.accent : C.grid}`,
        background: sort === k ? C.accent : "transparent",
        color: sort === k ? "#1a1206" : C.text,
        fontWeight: sort === k ? 600 : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <span style={metaLabel}>LAST {WINDOW_DAYS} DAYS — ARTIST STANDINGS</span>
          <p style={{ margin: "4px 0 0", fontFamily: C.mono, fontSize: 11, color: C.dim }}>
            {dateRange} · {Math.round(totalBattles)} battles · {sorted.length} artists
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <SortBtn k="battles" label="BATTLES" />
          <SortBtn k="wins" label="WINS" />
          <SortBtn k="vol" label="VOLUME" />
          <SortBtn k="winPct" label="WIN %" />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}` }}>
              {["#", "HANDLE", "B", "W", "L", "WIN %", "VOL ◎"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...metaLabel,
                    fontSize: 10,
                    padding: "6px 8px",
                    textAlign: h === "#" || h === "B" || h === "W" || h === "L" ? "center" : "left",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const winPct = s.battles > 0 ? (s.wins / s.battles) * 100 : 0;
              const isTop3 = i < 3;
              return (
                <tr
                  key={s.handle}
                  style={{
                    borderBottom: `1px solid ${C.grid}`,
                    background: isTop3 ? "rgba(255,194,75,0.04)" : "transparent",
                  }}
                >
                  <td style={{ padding: "7px 8px", color: isTop3 ? C.accent : C.dim, textAlign: "center", fontWeight: isTop3 ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: "7px 8px" }}>
                    <a
                      href={`/artist/${encodeURIComponent(s.handle)}`}
                      style={{ color: isTop3 ? C.accent : C.text, textDecoration: "none", fontWeight: isTop3 ? 600 : 400 }}
                    >
                      {s.handle}
                    </a>
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "center", color: C.dim, fontVariantNumeric: "tabular-nums" }}>{s.battles}</td>
                  <td style={{ padding: "7px 8px", textAlign: "center", color: C.good, fontVariantNumeric: "tabular-nums" }}>{s.wins}</td>
                  <td style={{ padding: "7px 8px", textAlign: "center", color: C.danger, fontVariantNumeric: "tabular-nums" }}>{s.battles - s.wins}</td>
                  <td style={{ padding: "7px 8px", color: winPct >= 60 ? C.good : winPct >= 40 ? C.text : C.danger, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(winPct, 0)}%
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.dim }}>{fmt(s.vol)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, margin: "10px 0 0", lineHeight: 1.5 }}>
        Only covers battles with handle data (June 2026+). Window = {WINDOW_DAYS} days before most-recent battle in snapshot.
      </p>
    </div>
  );
}
