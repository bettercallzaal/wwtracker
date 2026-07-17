"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

interface RawBattle {
  id: string;
  type: string;
  date: string;
  a: string;
  b: string;
  aHandle?: string;
  bHandle?: string;
  winner: string;
  vol: number;
}

interface Rivalry {
  handleA: string;
  handleB: string;
  total: number;
  winsA: number;
  winsB: number;
  vol: number;
  lastDate: string;
}

const MIN_MEETINGS = 2;

function buildRivalries(battles: RawBattle[]): Rivalry[] {
  const map = new Map<string, Rivalry>();

  for (const b of battles) {
    if (!b.aHandle || !b.bHandle || b.aHandle === b.bHandle) continue;
    const [lo, hi] =
      b.aHandle.toLowerCase() < b.bHandle.toLowerCase()
        ? [b.aHandle, b.bHandle]
        : [b.bHandle, b.aHandle];
    const key = `${lo}|${hi}`;

    if (!map.has(key)) {
      map.set(key, { handleA: lo, handleB: hi, total: 0, winsA: 0, winsB: 0, vol: 0, lastDate: b.date });
    }
    const r = map.get(key)!;
    r.total += 1;
    r.vol += b.vol;
    r.lastDate = b.date;

    const wonA =
      b.aHandle.toLowerCase() === lo
        ? b.winner === b.a
        : b.winner === b.b;
    if (wonA) r.winsA += 1;
    else r.winsB += 1;
  }

  return Array.from(map.values())
    .filter((r) => r.total >= MIN_MEETINGS)
    .sort((a, b) => b.total - a.total || b.vol - a.vol);
}

function dominance(r: Rivalry): string {
  const maxW = Math.max(r.winsA, r.winsB);
  if (maxW === r.total) return "SWEEP";
  const pct = ((maxW / r.total) * 100).toFixed(0);
  return `${pct}%`;
}

export default function RivalryBoard() {
  const [rivalries, setRivalries] = useState<Rivalry[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((all: RawBattle[]) => {
        if (alive) setRivalries(buildRivalries(all));
      })
      .catch(() => alive && setRivalries([]));
    return () => { alive = false; };
  }, []);

  if (!rivalries || rivalries.length === 0) return null;

  return (
    <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16, marginTop: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>RIVALRIES — HEAD-TO-HEAD RECORDS</span>
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginLeft: 10 }}>
          {rivalries.length} matchups with 2+ meetings
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
          <thead>
            <tr style={{ color: C.dim }}>
              <th style={{ textAlign: "left", padding: "4px 8px 8px 0", fontWeight: 400 }}>ARTIST A</th>
              <th style={{ textAlign: "center", padding: "4px 8px 8px", fontWeight: 400 }}>H2H RECORD</th>
              <th style={{ textAlign: "left", padding: "4px 8px 8px 0", fontWeight: 400 }}>ARTIST B</th>
              <th style={{ textAlign: "center", padding: "4px 8px 8px 0", fontWeight: 400 }}>BATTLES</th>
              <th style={{ textAlign: "center", padding: "4px 8px 8px 0", fontWeight: 400 }}>EDGE</th>
              <th style={{ textAlign: "right", padding: "4px 0 8px 8px", fontWeight: 400 }}>VOL</th>
            </tr>
          </thead>
          <tbody>
            {rivalries.map((r, i) => {
              const aLeads = r.winsA > r.winsB;
              const bLeads = r.winsB > r.winsA;
              return (
                <tr key={`${r.handleA}|${r.handleB}`} style={{ borderTop: `1px solid ${C.grid}`, background: i % 2 ? "transparent" : `${C.elev}` }}>
                  <td style={{ padding: "6px 8px 6px 0" }}>
                    <a href={`/artist/${r.handleA}`} style={{ color: aLeads ? C.good : bLeads ? C.danger : C.text, textDecoration: "none", fontWeight: aLeads ? 700 : 400 }}>
                      @{r.handleA}
                    </a>
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700 }}>
                    <span style={{ color: aLeads ? C.good : C.dim }}>{r.winsA}</span>
                    <span style={{ color: C.dim }}>–</span>
                    <span style={{ color: bLeads ? C.good : C.dim }}>{r.winsB}</span>
                  </td>
                  <td style={{ padding: "6px 8px 6px 0" }}>
                    <a href={`/artist/${r.handleB}`} style={{ color: bLeads ? C.good : aLeads ? C.danger : C.text, textDecoration: "none", fontWeight: bLeads ? 700 : 400 }}>
                      @{r.handleB}
                    </a>
                  </td>
                  <td style={{ padding: "6px 8px 6px 0", textAlign: "center", color: C.dim }}>{r.total}</td>
                  <td style={{ padding: "6px 8px 6px 0", textAlign: "center", color: r.winsA === r.total || r.winsB === r.total ? C.accent : C.text, fontWeight: 600 }}>
                    {dominance(r)}
                  </td>
                  <td style={{ padding: "6px 0 6px 8px", textAlign: "right", color: C.dim }}>{r.vol.toFixed(2)} ◎</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ ...metaLabel, fontSize: 10, marginTop: 10 }}>
        From battles with handle data · leader shown in green · SWEEP = perfect record
      </p>
    </section>
  );
}
