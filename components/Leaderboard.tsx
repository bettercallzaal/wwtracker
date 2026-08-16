"use client";

// Artist leaderboard, live from the cached fan-out route. Previously this rendered
// lib/leaderboard.ts - a hand-extracted snapshot dated 2026-06-15. It now reads
// /api/ww/leaderboards/artists (our own cached layer over wavewarz.info), so the
// page and any partner embed share one upstream call and one freshness contract.
//
// The failure contract matters here as much as the data: on "unknown" (upstream
// never reachable) this shows an explicit unavailable state, never a zeroed table.
// On "stale" it shows the last good data with an age note.

import { useEffect, useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { solNum, type ArtistLeaderboardEntry } from "@/lib/wavewarzApi";
import type { CacheStatus } from "@/lib/wwCache";
import { toCsv, downloadCsv } from "@/lib/csv";

// Maps leaderboard X handles to confirmed Audius handles.
const AUDIUS_MAP: Record<string, string> = {
  AporkALYPSE78: "AporkALYPSE78",
  Hurric4n3Ike: "Hurric4n3Ike",
  PKMNCTO: "PKMNCTO",
  geekmyth: "geekmyth",
  GodclouD: "GodclouD",
  Stormbourne: "Stormbourne",
  dopestilo: "dopestilo",
  luiwrites: "luiwrites",
  shawnsporter: "shawnsporter",
  hoodrats: "hoodrats",
  TuckNuisance: "TuckNuisance",
  BennyJ504WaveWarz: "BennyJ504WaveWarz",
  CannonJones973: "CannonJones973",
  XTincT_official: "XTincT_official",
  RoCkY2GriMeY__: "RoCkY2GriMeY",
};

type SortKey = "rank" | "win" | "vol" | "earn";

interface Row {
  rank: number;
  name: string;
  handle: string;
  rec: string;
  win: number;
  vol: number;
  earn: number;
}

interface Loaded {
  status: CacheStatus;
  ageSeconds: number | null;
  rows: Row[];
}

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Live entry -> display row. The API returns the list already ranked, so rank is index+1. */
function toRow(a: ArtistLeaderboardEntry, i: number): Row {
  return {
    rank: i + 1,
    name: (a.name ?? "").trim() || (a.wallet ? `${a.wallet.slice(0, 4)}...${a.wallet.slice(-4)}` : "unknown"),
    handle: a.twitterHandle ?? "",
    rec: `${a.wins ?? 0}W-${a.losses ?? 0}L`,
    win: a.winRate ?? 0,
    vol: solNum(a.totalVolumeSol) ?? 0,
    earn: solNum(a.totalEarningsSol) ?? 0,
  };
}

export default function Leaderboard() {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ww/leaderboards/artists?limit=100", { cache: "no-store" });
        const payload = await res.json();
        if (cancelled) return;
        const list: ArtistLeaderboardEntry[] = payload?.data?.artists ?? [];
        setLoaded({
          status: payload?.status ?? "unknown",
          ageSeconds: payload?.ageSeconds ?? null,
          rows: list.map(toRow),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = loaded?.rows ?? [];
  const totalVol = rows.reduce((s, a) => s + a.vol, 0);
  const totalEarn = rows.reduce((s, a) => s + a.earn, 0);

  const exportCsv = () => {
    const csv = toCsv(
      ["rank", "name", "handle", "record", "win_pct", "vol_sol", "earn_sol"],
      rows.map((a) => [a.rank, a.name, a.handle, a.rec, a.win, a.vol, a.earn]),
    );
    downloadCsv("wavewarz-leaderboard.csv", csv);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "rank");
    }
  };

  const needle = q.trim().toLowerCase();
  const sorted = useMemo(() => {
    const visible = rows.filter((a) => !needle || `${a.name} ${a.handle}`.toLowerCase().includes(needle));
    return [...visible].sort((a, b) => {
      let diff = 0;
      if (sortKey === "rank") diff = a.rank - b.rank;
      else if (sortKey === "win") diff = a.win - b.win;
      else if (sortKey === "vol") diff = a.vol - b.vol;
      else if (sortKey === "earn") diff = a.earn - b.earn;
      return sortAsc ? diff : -diff;
    });
  }, [rows, needle, sortKey, sortAsc]);

  const SortBtn = ({ col, label, right = true }: { col: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggleSort(col)}
      style={{
        ...th,
        textAlign: right ? "right" : "left",
        cursor: "pointer",
        userSelect: "none",
        color: sortKey === col ? C.accent : C.dim,
      }}
    >
      {label}
      {sortKey === col ? (sortAsc ? " ▲" : " ▼") : ""}
    </th>
  );

  // Freshness line, honest about live/stale/unknown.
  const freshness = (() => {
    if (error) return `live leaderboard could not load: ${error}`;
    if (!loaded) return "loading live leaderboard...";
    if (loaded.status === "live") return "live from wavewarz.info via the cached tracker API.";
    if (loaded.status === "stale") {
      const mins = loaded.ageSeconds != null ? Math.round(loaded.ageSeconds / 60) : null;
      return `live source unreachable - showing last good data${mins != null ? ` from ~${mins} min ago` : ""}.`;
    }
    return "live leaderboard is currently unavailable.";
  })();

  const unavailable = !error && loaded?.status === "unknown";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / artist leaderboard</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Artists ranked by Main Event wins. Each event = 2-of-3 or 3-of-5 rounds (Human
          Judge + X Poll + SOL Vote). Volume = SOL traded on that artist; earnings = 1% of
          volume + settlement bonuses. Live from the WaveWarZ API.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Tile label="ARTISTS" value={loaded && !unavailable ? `${rows.length}` : "-"} />
        <Tile label="TOTAL VOLUME" value={loaded && !unavailable ? `${fmt(totalVol, 1)} ◎` : "-"} />
        <Tile label="TOTAL EARNINGS" value={loaded && !unavailable ? `${fmt(totalEarn, 2)} ◎` : "-"} />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter by name or handle"
          aria-label="Filter leaderboard"
          style={{
            flex: 1,
            minWidth: 180,
            fontFamily: C.mono,
            fontSize: 13,
            padding: "8px 12px",
            borderRadius: 10,
            border: `1px solid ${C.grid}`,
            background: C.bg,
            color: C.text,
          }}
        />
        {q && (
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>
            {sorted.length} of {rows.length}
          </span>
        )}
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          style={{
            background: C.panel,
            border: `1px solid ${C.grid}`,
            color: rows.length === 0 ? C.dim : C.text,
            borderRadius: 8,
            padding: "6px 12px",
            fontFamily: C.mono,
            fontSize: 12,
            cursor: rows.length === 0 ? "default" : "pointer",
          }}
        >
          download CSV
        </button>
      </div>

      {unavailable ? (
        <section
          style={{
            background: C.panel,
            border: `1px solid ${C.grid}`,
            borderRadius: 16,
            padding: "28px 16px",
            textAlign: "center",
          }}
        >
          <p style={{ ...metaLabel, fontSize: 13, color: C.text }}>
            The live leaderboard is unavailable right now.
          </p>
          <p style={{ ...metaLabel, fontSize: 12, marginTop: 6 }}>
            This reads live from wavewarz.info and will return when the source is reachable.
            No numbers are shown rather than showing stale or zeroed data.
          </p>
        </section>
      ) : (
        <section
          style={{
            background: C.panel,
            border: `1px solid ${C.grid}`,
            borderRadius: 16,
            padding: "8px 4px",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: C.mono,
              fontSize: 12,
              minWidth: 520,
            }}
          >
            <thead>
              <tr style={{ color: C.dim, textAlign: "left" }}>
                <SortBtn col="rank" label="#" right={false} />
                <th style={{ ...th, textAlign: "left" }}>ARTIST</th>
                <th style={{ ...th, textAlign: "right" }}>REC</th>
                <SortBtn col="win" label="WIN%" />
                <SortBtn col="vol" label="VOL ◎" />
                <SortBtn col="earn" label="EARN ◎" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const audiusHandle = a.handle ? AUDIUS_MAP[a.handle] : undefined;
                return (
                  <tr key={`${a.rank}-${a.handle || a.name}`} style={{ borderTop: `1px solid ${C.grid}` }}>
                    <td style={td}>{a.rank}</td>
                    <td style={td}>
                      {a.handle ? (
                        <a href={`/artist/${a.handle}`} style={{ color: C.text, textDecoration: "none" }}>
                          {a.name}
                        </a>
                      ) : (
                        <span style={{ color: C.text }}>{a.name}</span>
                      )}{" "}
                      {a.handle && <span style={{ color: C.dim }}>@{a.handle}</span>}
                      {audiusHandle && (
                        <>
                          {" "}
                          <a
                            href={`https://audius.co/${audiusHandle}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: C.accent, textDecoration: "none", fontSize: 11 }}
                            title="Audius profile"
                          >
                            ♪
                          </a>
                        </>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: a.win >= 50 ? C.good : C.dim }}>{a.rec}</td>
                    <td style={{ ...td, textAlign: "right" }}>{a.win}%</td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(a.vol)}</td>
                    <td style={{ ...td, textAlign: "right", color: C.accent, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(a.earn, 3)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loaded && sorted.length === 0 && (
            <p style={{ ...metaLabel, fontSize: 12, padding: "16px 12px", textAlign: "center" }}>
              {q ? `no artists match "${q}"` : "no artists returned"}
            </p>
          )}
        </section>
      )}

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        {freshness} ♪ = confirmed on Audius. Artist name links to internal artist page.
        Click column headers to sort. Charity &amp; spotlight events excluded.
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.grid}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 10,
  letterSpacing: "0.06em",
  fontWeight: 400,
};
const td: React.CSSProperties = { padding: "8px 10px" };
