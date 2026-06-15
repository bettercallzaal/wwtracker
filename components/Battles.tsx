"use client";

import { useEffect, useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS as S } from "@/lib/battles";

interface Battle {
  id: string;
  type: "QUICK" | "MAIN" | "COMMUNITY";
  date: string;
  a: string;
  b: string;
  winner: string;
  margin: number | null;
  vol: number;
}

const fmt = (n: number, dp = 0) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
type Filter = "ALL" | "QUICK" | "MAIN" | "COMMUNITY";

export default function Battles() {
  const [all, setAll] = useState<Battle[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    let alive = true;
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((d) => { if (alive) setAll(d as Battle[]); })
      .catch(() => { if (alive) setAll([]); });
    return () => { alive = false; };
  }, []);

  // Battles + songs per night (from the dates). Songs = distinct titles in quick
  // battles that night; battles = all battle types that night.
  const perNight = useMemo(() => {
    if (!all) return [];
    const map = new Map<string, { battles: number; songs: Set<string> }>();
    for (const b of all) {
      const e = map.get(b.date) ?? { battles: 0, songs: new Set<string>() };
      e.battles += 1;
      if (b.type === "QUICK") { e.songs.add(b.a); e.songs.add(b.b); }
      map.set(b.date, e);
    }
    return [...map.entries()]
      .map(([date, v]) => ({ date, battles: v.battles, songs: v.songs.size, ts: Date.parse(date) }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 14);
  }, [all]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const needle = q.trim().toLowerCase();
    return all.filter((b) => {
      if (filter !== "ALL" && b.type !== filter) return false;
      if (!needle) return true;
      return `${b.a} ${b.b} ${b.winner}`.toLowerCase().includes(needle);
    });
  }, [all, q, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / battles</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          The full battle history - {all ? fmt(all.length) : "958"} battles, all
          time. Search by song or artist, filter by type.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <Tile label="TOTAL BATTLES" value={fmt(S.totalShown)} sub="all time" />
        <Tile label="QUICK BATTLES" value={fmt(S.quickBattles)} sub="song vs song" />
        <Tile label="MAIN EVENTS" value={fmt(S.events)} sub={`${S.multiRound} multi-round`} />
        <Tile label="TOTAL VOLUME" value={`${fmt(S.totalVolumeSol, 1)} ◎`} sub="SOL traded" />
        <Tile label="ARTIST PAYOUTS" value={`${fmt(S.artistPayoutsSol, 2)} ◎`} sub="to artists" />
      </div>

      {/* per night */}
      {perNight.length > 0 && (
        <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
          <div style={{ marginBottom: 12 }}><span style={metaLabel}>PER NIGHT (LAST 14 ACTIVE DATES)</span></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12, minWidth: 360 }}>
              <thead><tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={{ padding: "6px 10px" }}>NIGHT</th>
                <th style={{ padding: "6px 10px", textAlign: "right" }}>BATTLES</th>
                <th style={{ padding: "6px 10px", textAlign: "right" }}>SONGS</th>
              </tr></thead>
              <tbody>
                {perNight.map((n) => (
                  <tr key={n.date} style={{ borderTop: `1px solid ${C.grid}` }}>
                    <td style={{ padding: "6px 10px" }}>{n.date}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: C.accent }}>{n.battles}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{n.songs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>Songs = distinct titles in quick battles that night. Skips/queue/DJ-Wavy counts coming - need the per-action SOL prices.</p>
        </section>
      )}

      {/* search + filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(40); }}
          placeholder="search song or artist..."
          aria-label="Search battles"
          style={{ flex: 1, minWidth: 200, fontFamily: C.mono, fontSize: 13, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.grid}`, background: C.bg, color: C.text }}
        />
        {(["ALL", "QUICK", "MAIN", "COMMUNITY"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); setLimit(40); }}
            style={{ fontFamily: C.mono, fontSize: 11, padding: "8px 12px", borderRadius: 9, cursor: "pointer", border: `1px solid ${filter === f ? C.accent : C.grid}`, background: filter === f ? C.accent : "transparent", color: filter === f ? "#1a1206" : C.text }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ ...metaLabel, fontSize: 11 }}>{fmt(filtered.length)} battles{q ? ` matching "${q}"` : ""}</div>

      {all === null ? (
        <div className="skeleton-shimmer" style={{ height: 300, borderRadius: 16 }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.slice(0, limit).map((b) => (
            <a key={b.id} href={`https://wavewarz.info/battles/${b.id}`} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", textDecoration: "none", background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ fontFamily: C.mono, fontSize: 9, color: b.type === "QUICK" ? C.dim : C.accent, minWidth: 64 }}>{b.type}</span>
              <span style={{ flex: 1, minWidth: 180, fontSize: 14, color: C.text }}>
                <b style={{ color: b.winner === b.a ? C.good : C.text }}>{b.a}</b>
                <span style={{ color: C.dim }}> vs </span>
                <b style={{ color: b.winner === b.b ? C.good : C.text }}>{b.b}</b>
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>
                {b.vol > 0 ? `${fmt(b.vol, 3)} ◎` : ""}{b.margin != null ? ` +${b.margin}%` : ""} - {b.date}
              </span>
            </a>
          ))}
          {filtered.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + 60)}
              style={{ marginTop: 6, alignSelf: "center", fontFamily: C.mono, fontSize: 13, padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.grid}`, background: C.panel, color: C.accent, cursor: "pointer" }}>
              show more ({fmt(filtered.length - limit)} left)
            </button>
          )}
        </div>
      )}

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Full feed scraped from wavewarz.info via paginated render (949/958 battles
        parsed). Winners in green. Rows link to the battle detail. Snapshot
        2026-06-15.
      </p>
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
