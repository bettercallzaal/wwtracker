"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import {
  TECH_STACK,
  ACTIVE_INCOME_STREAMS,
  MONTHLY_LEDGERS,
  TREASURY_SNAPSHOTS,
  LIVE_TREASURY_SNAPSHOT,
  activeMonthlyTotalUsd,
  activeMonthlyIncomeUsd,
  sumUsd,
  type LedgerLineItem,
} from "@/lib/opsLedger";
import { getPublicStats, type PublicStats } from "@/lib/wavewarzApi";

const usd = (n: number | null | undefined, dp = 2) =>
  n === null || n === undefined ? "-" : `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

const sol = (n: number | null | undefined, dp = 3) =>
  n === null || n === undefined ? "-" : `${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })} ◎`;

export default function OpsLedger() {
  const activeMonthly = activeMonthlyTotalUsd(TECH_STACK);
  const activeIncome = activeMonthlyIncomeUsd(ACTIVE_INCOME_STREAMS);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setStatsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 34px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / running the business</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          What it actually costs to keep WaveWarZ running, and what's coming in against it. This is
          real-world spend the team tracks manually - not derivable on-chain - so figures here are
          transcribed as reported, with anything unreconciled flagged rather than smoothed over.
        </p>
      </header>

      <Panel label="LIVE PLATFORM STATS">
        {statsError && (
          <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 13 }}>
            WaveWarZ's public API didn't respond - showing everything else on this page as normal.
          </p>
        )}
        {!statsError && !stats && (
          <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 13 }}>loading...</p>
        )}
        {stats && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <Tile label="LIFETIME VOLUME">{sol(stats.volume.totalSol, 1)}</Tile>
              <Tile label="ARTIST PAYOUTS">{sol(stats.artistPayouts.totalSol, 2)}</Tile>
              <Tile label="TRADER CLAIMS">{sol(stats.traderClaims.totalSol, 1)}</Tile>
              <Tile label="PLATFORM REVENUE">{sol(stats.platformRevenue?.totalSol, 2)}</Tile>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12, marginTop: 12 }}>
              <Tile label="TOTAL BATTLES">{stats.battles.total}</Tile>
              <Tile label="MAIN EVENTS">{stats.battles.mainEvents}</Tile>
              <Tile label="QUICK BATTLES">{stats.battles.quickBattles}</Tile>
              <Tile label="COMMUNITY">{stats.battles.communityBattles}</Tile>
            </div>
            <p style={{ ...metaLabel, fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
              Live from WaveWarZ's own public API (wavewarz.info/api-docs), updated {new Date(stats.updatedAt).toLocaleString()}.
              Artist payouts = {stats.artistPayouts.note.toLowerCase()}. Trader claims = {stats.traderClaims.note.toLowerCase()}
              {" "}({stats.traderClaims.withdrawalCount.toLocaleString()} withdrawals). SOL @ ${stats.solPriceUsd}.
            </p>
          </>
        )}
      </Panel>

      <Panel label="LIVE FEE WALLET">
        <p style={{ margin: "0 0 12px", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
          <a
            href={`https://solscan.io/account/FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37`}
            target="_blank"
            rel="noreferrer"
            style={{ color: C.accent, textDecoration: "none" }}
          >
            FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37 ↗
          </a>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Tile label="SOL">{sol(LIVE_TREASURY_SNAPSHOT.solAmount)}</Tile>
          <Tile label="SOL (USD)">{usd(LIVE_TREASURY_SNAPSHOT.solUsd)}</Tile>
          <Tile label="$WARZ">{LIVE_TREASURY_SNAPSHOT.warzAmount?.toLocaleString()}</Tile>
          <Tile label="$WARZ (USD)">
            <span style={{ color: C.dim, fontSize: 14, fontWeight: 400 }}>no priced market</span>
          </Tile>
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
          Verified {LIVE_TREASURY_SNAPSHOT.date} - {LIVE_TREASURY_SNAPSHOT.source}
        </p>
      </Panel>

      <Panel label="HISTORICAL SNAPSHOTS (TEAM-REPORTED, UNVERIFIED)">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={th}>SNAPSHOT</th>
                <th style={{ ...th, textAlign: "right" }}>SOL</th>
                <th style={{ ...th, textAlign: "right" }}>SOL (USD)</th>
                <th style={{ ...th, textAlign: "right" }}>$WARZ</th>
                <th style={{ ...th, textAlign: "right" }}>$WARZ (USD)</th>
              </tr>
            </thead>
            <tbody>
              {TREASURY_SNAPSHOTS.map((s) => (
                <tr key={s.label} style={{ borderTop: `1px solid ${C.grid}` }}>
                  <td style={td}>{s.label}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{sol(s.solAmount)}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(s.solUsd, 0)}</td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {s.warzAmount?.toLocaleString()}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(s.warzUsd, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
          {TREASURY_SNAPSHOTS[0].source}
        </p>
      </Panel>

      <Panel label="TECH STACK">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={th}>SERVICE</th>
                <th style={{ ...th, textAlign: "right" }}>COST</th>
                <th style={th}>ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              {TECH_STACK.map((item) => (
                <tr key={item.name} style={{ borderTop: `1px solid ${C.grid}` }}>
                  <td style={td}>
                    {item.name}
                    {item.note && (
                      <div style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{item.note}</div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.accent }}>
                    {usd(item.amountUsd, item.amountUsd % 1 === 0 ? 0 : 2)}/{item.cadence === "monthly" ? "mo" : "wk"}
                  </td>
                  <td style={{ ...td, color: item.active ? C.good : C.danger }}>
                    {item.active ? "active" : "not active"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
          Active services run ~{usd(activeMonthly)}/mo (weekly costs normalized to a month).
        </p>
      </Panel>

      <Panel label="ACTIVE INCOME STREAMS">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={th}>SOURCE</th>
                <th style={{ ...th, textAlign: "right" }}>AMOUNT</th>
                <th style={th}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVE_INCOME_STREAMS.map((item) => (
                <tr key={item.name} style={{ borderTop: `1px solid ${C.grid}` }}>
                  <td style={td}>
                    {item.name}
                    {item.note && (
                      <div style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{item.note}</div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: C.good }}>
                    {usd(item.amountUsd, item.amountUsd % 1 === 0 ? 0 : 2)}
                    {item.cadence === "monthly" ? "/mo" : " one-time"}
                  </td>
                  <td style={{ ...td, color: item.active ? C.good : C.dim }}>
                    {item.active ? "recurring" : "one-off (past)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
          Recurring income runs ~{usd(activeIncome)}/mo against ~{usd(activeMonthly)}/mo in active costs -
          net ~{usd(activeIncome - activeMonthly)}/mo before any per-battle fee revenue.
        </p>
      </Panel>

      {MONTHLY_LEDGERS.map((ledger) => (
        <Panel key={ledger.month} label={ledger.label.toUpperCase()}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
            <LedgerTable title="EXPENSES" items={ledger.expenses} />
            <LedgerTable title="INCOME" items={ledger.income} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 14 }}>
            <Tile label="STATED EXPENSES">{usd(ledger.statedTotalExpensesUsd)}</Tile>
            <Tile label="STATED INCOME">{usd(ledger.statedTotalIncomeUsd)}</Tile>
            <Tile label="STATED P&L">
              <span style={{ color: ledger.statedProfitLossUsd === null ? C.dim : ledger.statedProfitLossUsd < 0 ? C.danger : C.good }}>
                {ledger.statedProfitLossUsd === null ? "not given" : usd(ledger.statedProfitLossUsd)}
              </span>
            </Tile>
          </div>
          {ledger.note && (
            <p style={{ ...metaLabel, fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>{ledger.note}</p>
          )}
        </Panel>
      ))}

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Live fee-wallet balance verified directly against Solana mainnet-beta RPC on the date shown.
        Everything else on this page is transcribed from the team's own manual tracking - treat
        historical and monthly figures as reported, not independently audited.
      </p>
    </div>
  );
}

function LedgerTable({ title, items }: { title: string; items: LedgerLineItem[] }) {
  const total = sumUsd(items);
  return (
    <div>
      <div style={{ ...metaLabel, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 8 }}>
            <span style={{ color: C.text }}>
              {item.label}
              {item.note && <span style={{ color: C.dim, fontSize: 11 }}> - {item.note}</span>}
            </span>
            <span style={{ color: C.accent, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {item.amountSol != null ? sol(item.amountSol) : usd(item.amountUsd)}
            </span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${C.grid}`, marginTop: 8, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, color: C.dim }}>
        <span>itemized $ sum</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{usd(total)}</span>
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={metaLabel}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{children}</span>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>{label}</span>
      </div>
      {children}
    </section>
  );
}

const th: React.CSSProperties = { padding: "8px 10px", fontSize: 11, letterSpacing: "0.06em", fontWeight: 400 };
const td: React.CSSProperties = { padding: "9px 10px" };
