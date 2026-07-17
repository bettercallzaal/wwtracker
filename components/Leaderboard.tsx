"use client";

import { useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { LEADERBOARD } from "@/lib/leaderboard";
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
  "RoCkY2GriMeY__": "RoCkY2GriMeY",
};

type SortKey = "rank" | "win" | "vol" | "earn";

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function Leaderboard() {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const totalVol = LEADERBOARD.reduce((s, a) => s + a.vol, 0);
  const totalEarn = LEADERBOARD.reduce((s, a) => s + a.earn, 0);

  const exportCsv = () => {
    const csv = toCsv(
      ["rank", "name", "handle", "record", "win_pct", "vol_sol", "earn_sol"],
      LEADERBOARD.map((a) => [a.rank, a.name, a.handle, a.rec, a.win, a.vol, a.earn])
    );
    downloadCsv("wavewarz-leaderboard.csv", csv);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key === "rank"); }
  };

  const needle = q.trim().toLowerCase();
  const visible = LEADERBOARD.filter(
    (a) =>
      !needle ||
      `${a.name} ${a.handle}`.toLowerCase().includes(needle)
  );

  const sorted = [...visible].sort((a, b) => {
    let diff = 0;
    if (sortKey === "rank") diff = a.rank - b.rank;
    else if (sortKey === "win") diff = a.win - b.win;
    else if (sortKey === "vol") diff = a.vol - b.vol;
    else if (sortKey === "earn") diff = a.earn - b.earn;
    return sortAsc ? diff : -diff;
  });

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / artist leaderboard</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          All <b>48 artists</b> ranked by Main Event wins. Each event = 2-of-3 or
          3-of-5 rounds (Human Judge + X Poll + SOL Vote). Volume = SOL traded on
          that artist; earnings = est. 1% of volume + settlement bonuses.
        </p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Tile label="ARTISTS" value={`${LEADERBOARD.length}`} />
        <Tile label="TOTAL VOLUME" value={`${fmt(totalVol, 1)} ◎`} />
        <Tile label="TOTAL EARNINGS" value={`${fmt(totalEarn, 2)} ◎`} />
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
            {sorted.length} of {LEADERBOARD.length}
          </span>
        )}
        <button
          onClick={exportCsv}
          style={{
            background: C.panel,
            border: `1px solid ${C.grid}`,
            color: C.text,
            borderRadius: 8,
            padding: "6px 12px",
            fontFamily: C.mono,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          download CSV
        </button>
      </div>

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
              const audiusHandle = AUDIUS_MAP[a.handle];
              return (
                <tr
                  key={`${a.rank}-${a.handle}`}
                  style={{ borderTop: `1px solid ${C.grid}` }}
                >
                  <td style={td}>{a.rank}</td>
                  <td style={td}>
                    <a
                      href={`/artist/${a.handle}`}
                      style={{ color: C.text, textDecoration: "none" }}
                    >
                      {a.name}
                    </a>{" "}
                    <span style={{ color: C.dim }}>@{a.handle}</span>
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
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      color: a.win >= 50 ? C.good : C.dim,
                    }}
                  >
                    {a.rec}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{a.win}%</td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmt(a.vol)}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      color: C.accent,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmt(a.earn, 3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p
            style={{
              ...metaLabel,
              fontSize: 12,
              padding: "16px 12px",
              textAlign: "center",
            }}
          >
            no artists match &quot;{q}&quot;
          </p>
        )}
      </section>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Snapshot from wavewarz.info (2026-06-15). ♪ = confirmed on Audius (link to
        profile). Artist name links to internal artist page. Click column headers
        to sort. Charity &amp; spotlight events excluded.
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
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
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
