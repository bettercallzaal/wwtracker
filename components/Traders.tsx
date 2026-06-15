"use client";

import { C, metaLabel } from "@/lib/theme";
import { TRADERS, ME_WALLET, TREASURY_WALLET } from "@/lib/traders";

const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;
const fmt = (n: number, dp = 2) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function Traders() {
  const me = TRADERS.find((t) => t.wallet === ME_WALLET);
  const top = TRADERS.slice(0, 40);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / traders</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          All <b>{TRADERS.length} traders</b> ranked by SOL volume. Net P&amp;L =
          payout received minus SOL invested (official). Top traders run negative -
          the house edge is real.
        </p>
      </header>

      {me && (
        <section style={{ background: `linear-gradient(135deg, ${C.panel}, ${C.elev})`, border: `1px solid ${C.accent}`, borderRadius: 16, padding: "clamp(16px,4vw,24px)" }}>
          <p style={metaLabel}>YOUR WALLET - RANK #{me.rank} OF {TRADERS.length}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginTop: 10 }}>
            <Cell label="NET P&L" value={`${me.pnl >= 0 ? "+" : ""}${fmt(me.pnl)} ◎`} color={me.pnl >= 0 ? C.good : C.danger} />
            <Cell label="RECORD" value={me.rec} />
            <Cell label="WIN RATE" value={`${me.win}%`} />
            <Cell label="VOLUME" value={`${fmt(me.vol)} ◎`} />
            <Cell label="TRADES" value={`${me.trades}`} />
            <Cell label="BATTLES" value={`${me.battles}`} />
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 10 }}>
            Official WaveWarZ figure. The My Trades tab&apos;s -2.96 ◎ is raw net
            SOL flow on-chain; this -{fmt(Math.abs(me.pnl))} ◎ nets settled payouts
            vs invested (the platform&apos;s own calc).
          </p>
        </section>
      )}

      <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: "8px 4px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12, minWidth: 560 }}>
          <thead>
            <tr style={{ color: C.dim, textAlign: "left" }}>
              <th style={th}>#</th>
              <th style={th}>WALLET</th>
              <th style={{ ...th, textAlign: "right" }}>REC</th>
              <th style={{ ...th, textAlign: "right" }}>WIN%</th>
              <th style={{ ...th, textAlign: "right" }}>VOL ◎</th>
              <th style={{ ...th, textAlign: "right" }}>TRADES</th>
              <th style={{ ...th, textAlign: "right" }}>NET P&L ◎</th>
            </tr>
          </thead>
          <tbody>
            {top.map((t) => {
              const mine = t.wallet === ME_WALLET;
              const treasury = t.wallet === TREASURY_WALLET;
              return (
                <tr key={t.wallet} style={{ borderTop: `1px solid ${C.grid}`, color: mine ? C.accent : C.text, background: mine ? "rgba(255,194,75,0.06)" : "transparent" }}>
                  <td style={td}>{t.rank}</td>
                  <td style={td} title={t.wallet}>
                    <a href={`https://solscan.io/account/${t.wallet}`} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                      {short(t.wallet)}
                    </a>
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
        Top 40 of {TRADERS.length} shown. Wallets link to Solscan. Snapshot from
        wavewarz.info (2026-06-15).
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
const td: React.CSSProperties = { padding: "8px 10px" };
