"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { FLOOR_SOL, RECIPIENTS, DISTRIBUTIONS, getDistributionBreakdown } from "@/lib/distributions";

const fmt = (n: number | null, dp = 1) => {
  if (n === null) return "TBD";
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
};

const short = (a: string) => (a ? `${a.slice(0, 4)}...${a.slice(-4)}` : "");

export default function Profitability() {
  // Prepare pie chart data from recipients
  const pieData = useMemo(() => {
    return RECIPIENTS.map((r) => ({
      name: r.name,
      value: r.percent,
    }));
  }, []);

  // Compute total distributed (only for non-null entries)
  const totalDistributed = useMemo(() => {
    return DISTRIBUTIONS.filter((d) => d.totalSol !== null).reduce((sum, d) => sum + (d.totalSol || 0), 0);
  }, []);

  // Count actual distributions (non-null)
  const actualDistributions = useMemo(
    () => DISTRIBUTIONS.filter((d) => d.totalSol !== null).length,
    [],
  );

  // Colors for pie chart (matching theme)
  const COLORS = [C.accent, C.good, "#7c8cff", "#d366ff"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 34px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / profitability</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          WaveWarZ is profitable. The platform runs to a {FLOOR_SOL} SOL operating floor,
          and distributions of excess profits have been made to the core team.
        </p>
      </header>

      {/* Key metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Tile label="DISTRIBUTIONS TO DATE">{actualDistributions || "awaiting data"}</Tile>
        <Tile label="TOTAL DISTRIBUTED">
          <span style={{ color: C.accent }}>{fmt(totalDistributed, 1)} ◎</span>
        </Tile>
        <Tile label="OPERATING FLOOR">{FLOOR_SOL} ◎</Tile>
      </div>

      {/* The model */}
      <Panel label="THE FLOOR MODEL">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, color: C.text, lineHeight: 1.6, fontSize: 14 }}>
            WaveWarZ treasury operates on a simple discipline:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 14 }}>
            <li>Treasury balance is held at a {FLOOR_SOL} SOL operating floor.</li>
            <li>When the balance climbs above {FLOOR_SOL} SOL, the excess is distributed to the team.</li>
            <li>The treasury is returned to approximately {FLOOR_SOL} SOL after each distribution.</li>
            <li>This discipline has held on-chain across multiple distribution cycles.</li>
          </ul>
        </div>
      </Panel>

      {/* Distribution split */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        {/* Pie chart */}
        <Panel label="SPLIT PER DISTRIBUTION">
          <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}%`}
                  outerRadius={80}
                  fill={C.accent}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            Each distribution is split proportionally: 33% to operations, 22% each to team members.
          </p>
        </Panel>

        {/* Recipients detail */}
        <Panel label="RECIPIENTS & ALLOCATION">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {RECIPIENTS.map((r) => (
              <div
                key={r.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: 12,
                  borderBottom: `1px solid ${C.grid}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{r.name}</div>
                  {r.wallet && (
                    <a
                      href={`https://solscan.io/address/${r.wallet}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: C.dim, fontFamily: C.mono, fontSize: 11, textDecoration: "none" }}
                      title={r.wallet}
                    >
                      {short(r.wallet)} ↗
                    </a>
                  )}
                  {!r.wallet && (
                    <div style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
                      wallet TBD
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.accent }}>{r.percent}%</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Distributions table */}
      <Panel label="DISTRIBUTION HISTORY">
        {DISTRIBUTIONS.length === 0 ? (
          <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 13 }}>No distributions recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.dim, textAlign: "left" }}>
                  <th style={th}>#</th>
                  <th style={th}>DATE</th>
                  <th style={{ ...th, textAlign: "right" }}>TOTAL ◎</th>
                  {RECIPIENTS.map((r) => (
                    <th key={r.name} style={{ ...th, textAlign: "right" }}>
                      {r.name.toUpperCase()} ({r.percent}%)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISTRIBUTIONS.map((d, i) => {
                  const breakdown = getDistributionBreakdown(d.totalSol);
                  const isTBD = d.totalSol === null;

                  return (
                    <tr key={i} style={{ borderTop: `1px solid ${C.grid}` }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>
                        {isTBD ? (
                          <span style={{ color: C.dim }}>TBD</span>
                        ) : (
                          d.date
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: isTBD ? C.dim : C.accent }}>
                        {fmt(d.totalSol)}
                      </td>
                      {RECIPIENTS.map((r) => (
                        <td
                          key={r.name}
                          style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: isTBD ? C.dim : C.text }}
                        >
                          {fmt(breakdown[r.name] as number | null)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {DISTRIBUTIONS.some((d) => d.totalSol === null) && (
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            Placeholder rows shown as TBD - awaiting actual distribution dates and amounts from the team.
          </p>
        )}
      </Panel>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Treasury balance data is on-chain on Solana. Distribution history is maintained by the
        WaveWarZ team. See docs/WAVEWARZ-RESEARCH.md for details.
      </p>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={metaLabel}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{children}</span>
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
