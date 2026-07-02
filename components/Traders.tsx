"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { TRADERS, ME_WALLET, TREASURY_WALLET, type Trader } from "@/lib/traders";
import { toCsv, downloadCsv } from "@/lib/csv";

const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;
const fmt = (n: number, dp = 2) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

type SortKey = "rank" | "win" | "vol" | "trades" | "pnl";

export default function Traders() {
  const me = TRADERS.find((t) => t.wallet === ME_WALLET) ?? null;

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const top = useMemo(() => {
    const arr = [...TRADERS].sort(
      (a, b) => ((a[sort.key] as number) - (b[sort.key] as number)) * sort.dir
    );
    return arr.slice(0, 40);
  }, [sort]);
  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 }
        : { key, dir: key === "rank" ? 1 : -1 }
    );
  const caret = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? " ^" : " v") : "");

  const exportCsv = () => {
    const csv = toCsv(
      ["rank", "wallet", "record", "win_pct", "vol_sol", "trades", "battles", "net_pnl_sol"],
      [...TRADERS].map((t) => [t.rank, t.wallet, t.rec, t.win, t.vol, t.trades, t.battles, t.pnl])
    );
    downloadCsv("wavewarz-traders.csv", csv);
  };

  const [query, setQuery] = useState("");
  const looked = useMemo<Trader | null>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return null;
    return TRADERS.find((t) => t.wallet.toLowerCase().includes(q)) ?? null;
  }, [query]);

  const shown = looked ?? me;
  const noMatch = query.trim().length >= 3 && !looked;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / traders</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          All <b>{TRADERS.length} traders</b> ranked by SOL volume. Net P&amp;L =
          payout received minus SOL invested (official). Search any wallet below.
        </p>
      </header>

      {/* wallet lookup */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="paste any wallet address to look it up..."
        aria-label="Look up a trader wallet"
        style={{ fontFamily: C.mono, fontSize: 13, padding: "11px 14px", borderRadius: 10, border: `1px solid ${looked ? C.accent : C.grid}`, background: C.bg, color: C.text }}
      />

      {noMatch && (
        <p style={{ fontFamily: C.mono, fontSize: 13, color: C.dim }}>
          That wallet isn&apos;t in the top {TRADERS.length} traders (or no match yet).
        </p>
      )}

      {shown && (
        <section style={{ background: `linear-gradient(135deg, ${C.panel}, ${C.elev})`, border: `1px solid ${C.accent}`, borderRadius: 16, padding: "clamp(16px,4vw,24px)" }}>
          <p style={metaLabel}>
            {shown.wallet === ME_WALLET ? "YOUR WALLET" : "TRADER"} - RANK #{shown.rank} OF {TRADERS.length}
            {shown.wallet === TREASURY_WALLET ? " (platform ops)" : ""}
          </p>
          <a href={`https://solscan.io/account/${shown.wallet}`} target="_blank" rel="noreferrer" style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, textDecoration: "none" }}>
            {short(shown.wallet)} &#8599;
          </a>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginTop: 12 }}>
            <Cell label="NET P&L" value={`${shown.pnl >= 0 ? "+" : ""}${fmt(shown.pnl)} ◎`} color={shown.pnl >= 0 ? C.good : C.danger} />
            <Cell label="RECORD" value={shown.rec} />
            <Cell label="WIN RATE" value={`${shown.win}%`} />
            <Cell label="VOLUME" value={`${fmt(shown.vol)} ◎`} />
            <Cell label="TRADES" value={`${shown.trades}`} />
            <Cell label="BATTLES" value={`${shown.battles}`} />
          </div>
        </section>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={exportCsv}
          style={{ background: C.panel, border: `1px solid ${C.grid}`, color: C.text, borderRadius: 8, padding: "6px 12px", fontFamily: C.mono, fontSize: 12, cursor: "pointer" }}
        >
          download CSV
        </button>
      </div>

      <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: "8px 4px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12, minWidth: 560 }}>
          <thead>
            <tr style={{ color: C.dim, textAlign: "left" }}>
              <th style={sortTh} onClick={() => toggleSort("rank")}>#{caret("rank")}</th>
              <th style={th}>WALLET</th>
              <th style={{ ...th, textAlign: "right" }}>REC</th>
              <th style={{ ...sortTh, textAlign: "right" }} onClick={() => toggleSort("win")}>WIN%{caret("win")}</th>
              <th style={{ ...sortTh, textAlign: "right" }} onClick={() => toggleSort("vol")}>VOL ◎{caret("vol")}</th>
              <th style={{ ...sortTh, textAlign: "right" }} onClick={() => toggleSort("trades")}>TRADES{caret("trades")}</th>
              <th style={{ ...sortTh, textAlign: "right" }} onClick={() => toggleSort("pnl")}>NET P&L ◎{caret("pnl")}</th>
            </tr>
          </thead>
          <tbody>
            {top.map((t) => {
              const mine = t.wallet === ME_WALLET;
              const treasury = t.wallet === TREASURY_WALLET;
              const hit = looked && t.wallet === looked.wallet;
              return (
                <tr key={t.wallet} style={{ borderTop: `1px solid ${C.grid}`, color: mine ? C.accent : C.text, background: hit || mine ? "rgba(255,194,75,0.06)" : "transparent" }}>
                  <td style={td}>{t.rank}</td>
                  <td style={td} title={t.wallet}>
                    <a href={`https://solscan.io/account/${t.wallet}`} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{short(t.wallet)}</a>
                    {mine ? " (you)" : treasury ? " (platform ops)" : ""}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{t.rec}</td>
                  <td style={{ ...td, textAlign: "right" }}>{t.win}%</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(t.vol)}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.trades}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: t.pnl >= 0 ? C.good : C.danger }}>{t.pnl >= 0 ? "+" : ""}{fmt(t.pnl)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Top 40 of {TRADERS.length} shown; search covers all {TRADERS.length}. Wallets link to Solscan. Snapshot 2026-06-15.
      </p>
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: color || C.text }}>{value}</span>
    </div>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.06em", fontWeight: 400 };
const sortTh: React.CSSProperties = { ...th, cursor: "pointer", userSelect: "none" };
const td: React.CSSProperties = { padding: "8px 10px" };
