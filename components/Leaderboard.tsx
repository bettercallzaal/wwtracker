"use client";

import { C, metaLabel } from "@/lib/theme";
import { LEADERBOARD } from "@/lib/leaderboard";
import { toCsv, downloadCsv } from "@/lib/csv";

// Maps leaderboard X/Twitter handle -> Audius handle for confirmed artists.
// Leaderboard uses X handles; Audius handles often differ. 15 confirmed pairs.
const AUDIUS_MAP: Record<string, string> = {
  // Exact matches (X handle = Audius handle)
  AporkALYPSE78:  "AporkALYPSE78",
  MetaVerseSlim:  "MetaVerseSlim",
  Hurric4n3Ike:   "Hurric4n3Ike",
  NFTWonderfull:  "NFTWonderfull",
  DCoopOfficial:  "DCoopOfficial",
  ItsMoneyMiller: "ItsMoneyMiller",
  PKMNCTO:        "PKMNCTO",
  // Different handles across platforms (confirmed per lib/artists.ts)
  cannonjones973:    "CannonJones973",
  kata7yst:          "Kata7yst",
  bennyj504:         "BennyJ504",
  "RoCkY2GriMeY__":  "RoCkY2GriMeY",
  therealgodcloud:   "GodclouD",
  GeEkMyTh_ETH:      "geekmyth",
  XTincT_io:         "XTincT_official",
  Stormiunleashed:   "Stormbourne",
};

const fmt = (n: number, dp = 2) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function Leaderboard() {
  const totalVol = LEADERBOARD.reduce((s, a) => s + a.vol, 0);
  const totalEarn = LEADERBOARD.reduce((s, a) => s + a.earn, 0);

  const exportCsv = () => {
    const csv = toCsv(
      ["rank", "name", "handle", "record", "win_pct", "vol_sol", "earn_sol"],
      LEADERBOARD.map((a) => [a.rank, a.name, a.handle, a.rec, a.win, a.vol, a.earn])
    );
    downloadCsv("wavewarz-leaderboard.csv", csv);
  };

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

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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

      <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: "8px 4px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12, minWidth: 520 }}>
          <thead>
            <tr style={{ color: C.dim, textAlign: "left" }}>
              <th style={th}>#</th>
              <th style={th}>ARTIST</th>
              <th style={{ ...th, textAlign: "right" }}>REC</th>
              <th style={{ ...th, textAlign: "right" }}>WIN%</th>
              <th style={{ ...th, textAlign: "right" }}>VOL ◎</th>
              <th style={{ ...th, textAlign: "right" }}>EARN ◎</th>
            </tr>
          </thead>
          <tbody>
            {LEADERBOARD.map((a) => {
              const audiusHandle = AUDIUS_MAP[a.handle];
              const href = audiusHandle ? `https://audius.co/${audiusHandle}` : `https://x.com/${a.handle}`;
              return (
                <tr key={`${a.rank}-${a.handle}`} style={{ borderTop: `1px solid ${C.grid}` }}>
                  <td style={td}>{a.rank}</td>
                  <td style={td}>
                    <a href={href} target="_blank" rel="noreferrer" style={{ color: C.text, textDecoration: "none" }}>
                      {a.name} <span style={{ color: C.dim }}>@{a.handle}</span>{audiusHandle ? " ♪" : ""}
                    </a>
                  </td>
                  <td style={{ ...td, textAlign: "right", color: a.win >= 50 ? C.good : C.dim }}>{a.rec}</td>
                  <td style={{ ...td, textAlign: "right" }}>{a.win}%</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(a.vol)}</td>
                  <td style={{ ...td, textAlign: "right", color: C.accent, fontVariantNumeric: "tabular-nums" }}>{fmt(a.earn, 3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Snapshot from wavewarz.info (2026-06-15). ♪ = confirmed on Audius (row
        links to their profile). Charity &amp; spotlight events excluded.
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.06em", fontWeight: 400 };
const td: React.CSSProperties = { padding: "8px 10px" };
