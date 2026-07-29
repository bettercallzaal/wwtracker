"use client";

import { C, metaLabel } from "@/lib/theme";
import { FLOOR_SOL } from "@/lib/config";

export default function HowItWorks() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / how it works</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          A battle is two songs going head-to-head. Fans buy SOL-backed shares on
          the side they think will win; the winning side splits the loser&apos;s
          pool. Everything is on-chain in native SOL - no platform token.
        </p>
      </header>

      <Section label="THE LIFECYCLE OF A BATTLE">
        <Step n="1" t="initializeBattle">
          Two artists are set, a SOL vault and two per-artist token mints (Artist A
          / Artist B) are created. The battle has a start and end time.
        </Step>
        <Step n="2" t="buyShares / sellShares">
          During the battle, fans trade SOL for shares of a side on a bonding curve
          (price rises as more is bought). You can sell back before settlement.
          Buy volume feeds the &quot;Charts&quot; score.
        </Step>
        <Step n="3" t="judging (best 2 of 3)">
          The winner is decided by Poll (community vote) + Charts (SOL volume) + DJ
          Wavy (an AI judge) - best two of three.
        </Step>
        <Step n="4" t="endBattle">
          After the end time, the battle settles. The losing side&apos;s pool is
          distributed (see splits below).
        </Step>
        <Step n="5" t="claimShares">
          Winners must manually claim their winnings - payouts are not automatic.
        </Step>
      </Section>

      <Section label="WHERE THE MONEY GOES">
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
          <tbody>
            <Row k="Each trade -> artist" v="1.0%" />
            <Row k="Each trade -> platform" v="0.5%" />
            <Row k="Each trade -> stays in the pool" v="~98.5%" />
            <Row k="Settlement: winning traders (pro-rata)" v="40% of loser pool" />
            <Row k="Settlement: losing traders refund" v="50% of loser pool" />
            <Row k="Settlement: winning artist" v="5% of loser pool" />
            <Row k="Settlement: losing artist" v="2% of loser pool" />
            <Row k="Settlement: platform" v="3% of loser pool" />
          </tbody>
        </table>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
          Per the on-chain IDL. So even a losing artist earns, and the platform
          takes a small cut of every trade plus settlement.
        </p>
      </Section>

      <Section label="FORMATS">
        <ul style={listStyle}>
          <li><b>Quick Battles</b> - single song vs song, run nightly.</li>
          <li><b>Main Events</b> - catalog vs catalog across multiple rounds / tournament brackets.</li>
        </ul>
      </Section>

      <Section label="GLOSSARY">
        <ul style={listStyle}>
          <li><b>Shares</b> - per-artist tokens you buy on the bonding curve; your stake on a side.</li>
          <li><b>Vault</b> - the on-chain SOL pool for a battle (a program PDA).</li>
          <li><b>Loser pool</b> - the SOL staked on the losing side, redistributed at settlement.</li>
          <li><b>Claim</b> - manually withdrawing your winnings after a battle settles.</li>
          <li><b>Floor</b> - the ~{FLOOR_SOL} SOL the treasury keeps; founders skim the excess.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>{label}</span>
      </div>
      {children}
    </section>
  );
}

function Step({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: `1px solid ${C.grid}` }}>
      <span style={{ fontFamily: C.mono, color: C.accent, fontWeight: 700, minWidth: 18 }}>{n}</span>
      <div>
        <div style={{ fontFamily: C.mono, color: C.accent, fontSize: 13 }}>{t}</div>
        <div style={{ color: C.text, lineHeight: 1.6, fontSize: 14, marginTop: 2 }}>{children}</div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr style={{ borderTop: `1px solid ${C.grid}` }}>
      <td style={{ padding: "8px 10px 8px 0", color: C.dim }}>{k}</td>
      <td style={{ padding: "8px 0", textAlign: "right", color: C.text }}>{v}</td>
    </tr>
  );
}

const listStyle: React.CSSProperties = { margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 14 };
