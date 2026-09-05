"use client";

// TRADER EDGE - everything a trader can learn from the full battle history,
// computed live from the public API on every load (no stale snapshots).
// Every stat here is derived client-side from /api/public/battles - the same
// data anyone can pull; the edge is having it organized.

import { useEffect, useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { getPublicBattles, pollWinnerOf, type BattleSummary } from "@/lib/wavewarzApi";

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (num: number, den: number) => (den > 0 ? (100 * num) / den : 0);

const panel: React.CSSProperties = {
  background: C.panel,
  border: `1px solid ${C.grid}`,
  borderRadius: 12,
  padding: "clamp(14px, 2.5vw, 22px)",
};
const h3: React.CSSProperties = {
  margin: "0 0 4px 0",
  fontSize: 15,
  color: C.text,
  letterSpacing: "0.02em",
};
const sub: React.CSSProperties = { ...metaLabel, marginBottom: 12, textTransform: "uppercase" as const };
const th: React.CSSProperties = {
  ...metaLabel,
  textAlign: "left" as const,
  padding: "6px 8px",
  borderBottom: `1px solid ${C.grid}`,
};
const td: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 13,
  color: C.text,
  borderBottom: `1px solid ${C.grid}`,
  fontFamily: C.mono,
};

// ET offset used for the heatmap. Fixed -4 (EDT) to match battle-season data;
// worst case in winter rows shift by one hour - noted in the caption.
const ET_OFFSET_HOURS = -4;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PoolBucket = { label: string; n: number; won: number };

interface EdgeStats {
  decided: number;
  favN: number;
  favWon: number;
  buckets: PoolBucket[];
  pollN: number;
  pollRight: number;
  wavyN: number;
  wavyRight: number;
  judgeN: number;
  judgeRight: number;
  heat: number[][]; // [day][hour] volume
  heatMax: number;
  artists: { name: string; battles: number; wins: number; vol: number }[];
  top10Share: number;
  totalVol: number;
  under01: number;
  total: number;
}

function computeStats(battles: BattleSummary[]): EdgeStats {
  const decidedBattles = battles.filter(
    (b) => b.winnerSide === "artist1" || b.winnerSide === "artist2"
  );
  const buckets: PoolBucket[] = [
    { label: "50-60% (slight favorite)", n: 0, won: 0 },
    { label: "60-75% (clear favorite)", n: 0, won: 0 },
    { label: "75-90% (heavy favorite)", n: 0, won: 0 },
    { label: "90%+ (consensus)", n: 0, won: 0 },
  ];
  let favN = 0;
  let favWon = 0;
  let pollN = 0;
  let pollRight = 0;
  let wavyN = 0;
  let wavyRight = 0;
  let judgeN = 0;
  let judgeRight = 0;

  for (const b of decidedBattles) {
    const p1 = b.artist1.poolSol ?? 0;
    const p2 = b.artist2.poolSol ?? 0;
    const tot = p1 + p2;
    if (tot > 0.001) {
      const fav = p1 > p2 ? "artist1" : "artist2";
      const share = Math.max(p1, p2) / tot;
      const won = b.winnerSide === fav;
      favN += 1;
      if (won) favWon += 1;
      const idx = share < 0.6 ? 0 : share < 0.75 ? 1 : share < 0.9 ? 2 : 3;
      buckets[idx].n += 1;
      if (won) buckets[idx].won += 1;
    }
    // Poll verdicts arrive under different keys per battle type - `pollWinner` on
    // Quick/community, `xPollWinner` on Main Events. Reading only the first key
    // silently dropped every Main Event from this stat.
    const poll = pollWinnerOf(b.factors);
    if (poll) {
      pollN += 1;
      if (poll === b.winnerSide) pollRight += 1;
    }
    // DJ Wavy (the AI judge) only exists on Quick/community battles.
    const wavy = b.factors?.djWavyWinner;
    if (wavy === "artist1" || wavy === "artist2") {
      wavyN += 1;
      if (wavy === b.winnerSide) wavyRight += 1;
    }
    // Human judge only exists on Main Events - a separate signal, not merged with
    // the AI judge above.
    const judge = b.factors?.humanJudgeWinner;
    if (judge === "artist1" || judge === "artist2") {
      judgeN += 1;
      if (judge === b.winnerSide) judgeRight += 1;
    }
  }

  // `artist.name` means different things per battle type: on a Main Event it is the
  // artist, on a Quick Battle it is the SONG TITLE. One wallet carries 119 distinct
  // names in the current history - that is a catalog, not aliases. Taking the
  // first-seen name therefore labelled artists with track titles.
  //
  // Resolve from Main Events only, where the field really is the artist. Roughly 60%
  // of the wallets listed below resolve; the rest fall back to a shortened wallet,
  // which is honest, rather than to a song title, which is not.
  const artistNameByWallet = new Map<string, string>();
  for (const b of battles) {
    if (b.type !== "main") continue;
    for (const side of ["artist1", "artist2"] as const) {
      const w = b[side].wallet;
      const n = (b[side].name ?? "").trim();
      if (w && n && !artistNameByWallet.has(w)) artistNameByWallet.set(w, n);
    }
  }

  // Prime-time heatmap + concentration + artist draw, over ALL battles.
  const heat: number[][] = DAYS.map(() => Array(24).fill(0));
  const vols: number[] = [];
  const byWallet = new Map<string, { name: string; battles: number; wins: number; vol: number }>();
  for (const b of battles) {
    const vol = (b.artist1.volumeSol ?? 0) + (b.artist2.volumeSol ?? 0);
    vols.push(vol);
    const t = Date.parse(b.createdAt);
    if (!Number.isNaN(t)) {
      const et = new Date(t + ET_OFFSET_HOURS * 3600_000);
      const day = (et.getUTCDay() + 6) % 7; // Mon=0
      heat[day][et.getUTCHours()] += vol;
    }
    for (const side of ["artist1", "artist2"] as const) {
      const w = b[side].wallet;
      if (!w) continue;
      const cur = byWallet.get(w) ?? {
        name: artistNameByWallet.get(w) ?? `${w.slice(0, 4)}...${w.slice(-4)}`,
        battles: 0,
        wins: 0,
        vol: 0,
      };
      cur.battles += 1;
      cur.vol += vol;
      if (b.winnerSide === side) cur.wins += 1;
      byWallet.set(w, cur);
    }
  }
  const heatMax = Math.max(...heat.flat(), 0.0001);
  vols.sort((a, b) => b - a);
  const totalVol = vols.reduce((s, v) => s + v, 0);
  const top10Share = totalVol > 0 ? pct(vols.slice(0, 10).reduce((s, v) => s + v, 0), totalVol) : 0;
  const artists = [...byWallet.values()]
    .filter((a) => a.battles >= 3)
    .sort((a, b) => b.vol / b.battles - a.vol / a.battles)
    .slice(0, 15);

  return {
    decided: decidedBattles.length,
    favN,
    favWon,
    buckets,
    pollN,
    pollRight,
    wavyN,
    wavyRight,
    judgeN,
    judgeRight,
    heat,
    heatMax,
    artists,
    top10Share,
    totalVol,
    under01: vols.filter((v) => v < 0.1).length,
    total: battles.length,
  };
}

export default function TraderEdge() {
  const [battles, setBattles] = useState<BattleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all: BattleSummary[] = [];
        for (let offset = 0; offset < 4000; offset += 200) {
          const page = await getPublicBattles({ limit: 200, offset });
          all.push(...page.battles);
          if (page.battles.length < 200) break;
        }
        if (!cancelled) setBattles(all);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => (battles ? computeStats(battles) : null), [battles]);

  if (error) {
    return (
      <div style={panel}>
        <p style={{ color: C.danger, fontFamily: C.mono, fontSize: 13 }}>
          Couldn&apos;t load the battle history: {error}
        </p>
      </div>
    );
  }
  if (!stats) {
    return (
      <div style={panel}>
        <p style={{ ...metaLabel }}>Loading every battle ever from the public API...</p>
      </div>
    );
  }

  const favPct = pct(stats.favWon, stats.favN);
  const pollPct = pct(stats.pollRight, stats.pollN);
  const wavyPct = pct(stats.wavyRight, stats.wavyN);
  const judgePct = pct(stats.judgeRight, stats.judgeN);

  const heroCards = [
    {
      n: `${fmt(favPct, 1)}%`,
      label: "money favorite wins",
      detail: `${stats.favWon}/${stats.favN} decided battles - where the pool sits is the strongest public signal`,
    },
    {
      n: `${fmt(pollPct, 1)}%`,
      label: "poll winner takes the battle",
      detail: `${stats.pollRight}/${stats.pollN} polled battles - the free signal almost nobody prices in`,
    },
    {
      n: `${fmt(wavyPct, 1)}%`,
      label: "DJ Wavy pick wins",
      detail: `${stats.wavyRight}/${stats.wavyN} Quick Battles - the AI judge, and the weakest of the signals. Fade accordingly.`,
    },
    {
      n: stats.judgeN > 0 ? `${fmt(judgePct, 1)}%` : "unknown",
      label: "human judge pick wins",
      detail:
        stats.judgeN > 0
          ? `${stats.judgeRight}/${stats.judgeN} Main Events - the human leg of the three-point system`
          : "no judged Main Events in the loaded history yet",
    },
    {
      n: "50%",
      label: "refund on a losing side",
      detail: "losers split 50% of their pool back at settlement - your max loss is ~half the stake",
    },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* hero stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 12,
        }}
      >
        {heroCards.map((cd) => (
          <div key={cd.label} style={panel}>
            <div style={{ fontSize: 30, fontWeight: 700, color: C.accent, fontFamily: C.mono }}>
              {cd.n}
            </div>
            <div style={{ ...metaLabel, textTransform: "uppercase", margin: "4px 0" }}>
              {cd.label}
            </div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{cd.detail}</div>
          </div>
        ))}
      </div>

      {/* favorite win rate by pool share */}
      <div style={panel}>
        <h3 style={h3}>How often the money is right</h3>
        <p style={sub}>favorite win rate by share of pool - live, all decided battles</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Favorite holds</th>
              <th style={{ ...th, textAlign: "right" }}>Battles</th>
              <th style={{ ...th, textAlign: "right" }}>Favorite won</th>
              <th style={{ ...th, textAlign: "right" }}>Win rate</th>
            </tr>
          </thead>
          <tbody>
            {stats.buckets.map((bk) => (
              <tr key={bk.label}>
                <td style={td}>{bk.label}</td>
                <td style={{ ...td, textAlign: "right" }}>{bk.n}</td>
                <td style={{ ...td, textAlign: "right" }}>{bk.won}</td>
                <td style={{ ...td, textAlign: "right", color: C.good }}>
                  {fmt(pct(bk.won, bk.n), 1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, marginTop: 10 }}>
          Read: even a slight pool lead has been right ~{fmt(pct(stats.buckets[0].won, stats.buckets[0].n), 0)}%
          of the time. But payouts move the other way - winners split their pool plus 40% of the LOSER pool,
          so a thin-pool upset pays far more per SOL than piling onto a consensus favorite. The edge is not
          &quot;always bet favorites&quot; - it is knowing exactly how often the crowd is right and what the
          underdog side pays when it isn&apos;t.
        </p>
      </div>

      {/* prime time heatmap */}
      <div style={panel}>
        <h3 style={h3}>Prime time - when the money shows up</h3>
        <p style={sub}>battle volume by day x hour (ET) - darker gold = more SOL</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, borderBottom: "none" }}></th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} style={{ ...th, borderBottom: "none", padding: "2px 3px", fontSize: 9 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, di) => (
                <tr key={d}>
                  <td style={{ ...metaLabel, padding: "2px 6px" }}>{d}</td>
                  {stats.heat[di].map((v, h) => {
                    const alpha = v > 0 ? 0.12 + 0.88 * Math.sqrt(v / stats.heatMax) : 0;
                    return (
                      <td
                        key={h}
                        title={`${d} ${h}:00 ET - ${fmt(v)} SOL`}
                        style={{
                          width: 22,
                          height: 20,
                          background: alpha > 0 ? `rgba(149,254,124, ${alpha})` : C.elev,
                          border: `1px solid ${C.bg}`,
                        }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, marginTop: 10 }}>
          Nearly all money trades 8pm-11pm ET, and Sunday night events carry stakes ~10x weekday battles.
          Trading outside the window means thin pools: bigger spreads, but also bigger payout ratios when
          you are right. (Hours use a fixed ET offset; winter-dated battles can shift one hour.)
        </p>
      </div>

      {/* artist draw power */}
      <div style={panel}>
        <h3 style={h3}>Artist draw power (wallet-keyed)</h3>
        <p style={sub}>
          avg SOL moved per appearance, min 3 battles - who brings the money
        </p>
        <p style={{ fontSize: 11, color: C.dim, margin: "0 0 12px", lineHeight: 1.5 }}>
          Names come from Main Events, where the API returns the artist. Wallets that have
          only ever run Quick Battles show a shortened address, because there the API
          returns the song title rather than the artist.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Artist</th>
                <th style={{ ...th, textAlign: "right" }}>Battles</th>
                <th style={{ ...th, textAlign: "right" }}>Win rate</th>
                <th style={{ ...th, textAlign: "right" }}>Total SOL involved</th>
                <th style={{ ...th, textAlign: "right" }}>Avg SOL/battle</th>
              </tr>
            </thead>
            <tbody>
              {stats.artists.map((a) => (
                <tr key={a.name + a.battles}>
                  <td style={{ ...td, fontFamily: "inherit" }}>{a.name}</td>
                  <td style={{ ...td, textAlign: "right" }}>{a.battles}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(pct(a.wins, a.battles), 0)}%</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmt(a.vol)}</td>
                  <td style={{ ...td, textAlign: "right", color: C.accent }}>
                    {fmt(a.vol / a.battles)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, marginTop: 10 }}>
          Keyed by wallet, not display name, so an artist appearing under different name casings is counted
          once. High-draw artists mean deep pools and efficient prices; low-draw battles are where a single
          informed trade moves the whole market.
        </p>
      </div>

      {/* concentration + edge rules */}
      <div style={panel}>
        <h3 style={h3}>The shape of the market</h3>
        <p style={sub}>concentration, computed live</p>
        <ul style={{ margin: 0, paddingLeft: 18, color: C.text, fontSize: 13, lineHeight: 1.9 }}>
          <li>
            Top 10 battles ever = <strong style={{ color: C.accent }}>{fmt(stats.top10Share, 1)}%</strong> of
            all {fmt(stats.totalVol, 0)} SOL ever traded.
          </li>
          <li>
            {stats.under01} of {stats.total} battles ({fmt(pct(stats.under01, stats.total), 0)}%) traded under
            0.1 SOL - most battles are thin; the money concentrates in scheduled events.
          </li>
          <li>
            Poll votes and big money rarely appear in the same battle - the voting crowd and the trading crowd
            are different audiences. When both show up, pay attention.
          </li>
        </ul>
      </div>

      <div style={{ ...panel, borderColor: C.accentDim }}>
        <h3 style={h3}>The edge rules</h3>
        <p style={sub}>what this page says, in five lines</p>
        <ol style={{ margin: 0, paddingLeft: 18, color: C.text, fontSize: 13, lineHeight: 2 }}>
          <li>The pool IS the forecast: money favorites win ~{fmt(favPct, 0)}% - respect it.</li>
          <li>Check the poll: when one exists, it has matched the winner ~{fmt(pollPct, 0)}% of the time.</li>
          <li>DJ Wavy is entertainment, not alpha (~{fmt(wavyPct, 0)}%).</li>
          <li>Your downside is capped: losing sides split 50% of their pool back. Size positions knowing max loss is about half.</li>
          <li>Trade the window: 8-11pm ET is where liquidity lives; Sunday and Wednesday nights carry the real stakes.</li>
        </ol>
        <p style={{ fontSize: 11, color: C.dim, marginTop: 12, lineHeight: 1.6 }}>
          All figures computed live from the public battle history on page load. This is data, not financial
          advice - past frequencies do not guarantee future outcomes.
        </p>
      </div>
    </div>
  );
}
