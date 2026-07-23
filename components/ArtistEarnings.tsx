"use client";

import { useEffect, useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS } from "@/lib/battles";

interface Battle {
  type: string;
  vol: number;
  a: string;
  b: string;
  winner: string;
  aHandle?: string;
  bHandle?: string;
}

interface ArtistStat {
  handle: string;
  battles: number;
  wins: number;
  vol: number;
  estEarned: number;
}

// Estimation formula based on on-chain fee structure (docs/WAVEWARZ-RESEARCH.md §3):
//   Per trade: 1% goes to the artist on that side. Assuming ~50/50 volume split
//   between sides → each artist earns ~0.5% of total battle vol from trade fees.
//   At settlement: winning artist receives 5% of loser pool (~50% of vol) = 2.5% of vol.
//                  losing artist receives 2% of loser pool (~50% of vol) = 1.0% of vol.
//   Total estimate: winner ≈ 3.0% of vol, loser ≈ 1.5% of vol.
const WIN_RATE = 0.030;
const LOSS_RATE = 0.015;

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

type SortKey = "estEarned" | "vol" | "wins" | "battles";

export default function ArtistEarnings() {
  const [battles, setBattles] = useState<Battle[] | null>(null);
  const [sort, setSort] = useState<SortKey>("estEarned");

  useEffect(() => {
    let alive = true;
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((d: Battle[]) => alive && setBattles(d))
      .catch(() => alive && setBattles([]));
    return () => { alive = false; };
  }, []);

  const stats = useMemo<ArtistStat[]>(() => {
    if (!battles) return [];
    const map = new Map<string, ArtistStat>();
    for (const b of battles) {
      const ah = b.aHandle?.toLowerCase().trim();
      const bh = b.bHandle?.toLowerCase().trim();
      if (!ah || !bh || ah === bh) continue;
      const aWon = b.winner?.trim() === b.a?.trim();
      const vol = b.vol ?? 0;
      for (const [h, won] of [[ah, aWon], [bh, !aWon]] as [string, boolean][]) {
        const s = map.get(h) ?? { handle: h, battles: 0, wins: 0, vol: 0, estEarned: 0 };
        s.battles += 1;
        s.vol += vol;
        if (won) s.wins += 1;
        s.estEarned += won ? WIN_RATE * vol : LOSS_RATE * vol;
        map.set(h, s);
      }
    }
    return Array.from(map.values()).sort((a, b) => b[sort] - a[sort]);
  }, [battles, sort]);

  const handledBattles = useMemo(() => {
    if (!battles) return 0;
    return battles.filter((b) => b.aHandle && b.bHandle && b.aHandle !== b.bHandle).length;
  }, [battles]);

  if (!battles) return <div className="skeleton-shimmer" style={{ height: 180, borderRadius: 14 }} />;
  if (!stats.length) return null;

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
          <span style={metaLabel}>ARTIST EARNINGS ESTIMATE</span>
          <p style={{ margin: "4px 0 0", fontFamily: C.mono, fontSize: 11, color: C.dim, maxWidth: 560 }}>
            Estimated from {handledBattles} handle-tracked battles (June 2026+). Formula: winner ≈ 3% of vol, loser ≈ 1.5%
            {" "}(1% trade fee + settlement bonus from on-chain split). Not audited — for illustration only.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <SortBtn k="estEarned" label="EARNED" />
          <SortBtn k="vol" label="VOLUME" />
          <SortBtn k="wins" label="WINS" />
          <SortBtn k="battles" label="BATTLES" />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}` }}>
              {["#", "HANDLE", "BATTLES", "W", "L", "VOL ◎", "EST. EARNED ◎"].map((h) => (
                <th key={h} style={{ ...metaLabel, fontSize: 10, padding: "6px 8px", textAlign: h === "#" || h === "W" || h === "L" ? "center" : "left", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => {
              const winPct = s.battles > 0 ? (s.wins / s.battles) * 100 : 0;
              return (
                <tr
                  key={s.handle}
                  style={{ borderBottom: `1px solid ${C.grid}`, opacity: 0.95 }}
                >
                  <td style={{ padding: "7px 8px", color: C.dim, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{i + 1}</td>
                  <td style={{ padding: "7px 8px" }}>
                    <a
                      href={`/artist/${encodeURIComponent(s.handle)}`}
                      style={{ color: C.accent, textDecoration: "none", fontWeight: 600 }}
                    >
                      {s.handle}
                    </a>
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.dim }}>{s.battles}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.good }}>{s.wins}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.danger }}>{s.battles - s.wins}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(s.vol)}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: winPct >= 50 ? C.good : C.accent, fontWeight: 600 }}>
                    {fmt(s.estEarned, 4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, margin: "12px 0 0", lineHeight: 1.6 }}>
        Platform-confirmed total artist payouts: <strong style={{ color: C.text }}>{BATTLE_STATS.artistPayoutsSol.toFixed(2)} SOL</strong> across all {BATTLE_STATS.totalShown.toLocaleString()} battles
        (source: wavewarz.info/api/public/stats). Earnings above cover the {handledBattles} battles with handle data only.
        Win-coloured green = positive estimated ROI vs losing the same battles; amber = losers.
      </p>
    </div>
  );
}
