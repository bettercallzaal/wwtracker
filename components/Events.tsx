"use client";

import { C, metaLabel } from "@/lib/theme";
import { WW } from "@/lib/wwData";

export default function Events() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / events</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Battles run live on a regular schedule, plus tournament brackets with
          per-round SOL payouts.
        </p>
      </header>

      <Section label="LIVE PROGRAMMING">
        <ul style={listStyle}>
          <li><b>Quick Battles</b> - weeknights ~8:30 PM EST, with a 30-second final trading window.</li>
          <li><b>Community AMAs</b> - Monday-Friday ~11:00 AM EST.</li>
          <li>Primarily on <b>X Spaces</b>; also on YouTube.</li>
        </ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Link href="https://x.com/WaveWarZ" label="X / @WaveWarZ" />
          <Link href="https://www.youtube.com/@WaveWarZ" label="YouTube" />
        </div>
      </Section>

      <Section label="TOURNAMENTS">
        <ul style={listStyle}>
          <li><b>Artist Tournament</b> - 16-artist single-elimination bracket, with instant SOL payouts to winners each round.</li>
          <li><b>AI Artist Tournament</b> - bracket of AI-generated tracks, community-voted, same payout structure.</li>
        </ul>
      </Section>

      <Section label="BATTLE TYPES (ALL-TIME)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Stat label="QUICK BATTLES" value="886" sub="single song vs song" />
          <Stat label="MAIN-EVENT BATTLES" value="152" sub="across 48 tournaments" />
          <Stat label="ON-CHAIN BATTLES" value={WW.program.battlesCreated.toLocaleString()} sub="initializeBattle calls" />
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
          Quick + main-event counts per wavewarz.info; the on-chain figure counts
          every initializeBattle. The gap reflects different definitions (e.g.
          multi-song main events).
        </p>
      </Section>

      <Section label="FEATURED ARTIST">
        <h2 style={{ margin: 0, fontSize: 18 }}>XTinct</h2>
        <p style={{ margin: "6px 0 0", color: C.text, lineHeight: 1.6, fontSize: 14 }}>
          Alejandro Estrella - Chicago-born bilingual artist mixing dark ambient
          sounds with trippy visuals. Featured in a WaveWarZ artist interview.
        </p>
        <div style={{ marginTop: 8 }}>
          <Link href="https://www.youtube.com/watch?v=FmrzjYtdF6A" label="Watch the interview" />
        </div>
      </Section>

      <Section label="RECENT">
        <ul style={listStyle}>
          <li>Mar 2026 - roadmap update from the WaveWarZ X account.</li>
          <li>Mar 2026 - artist interview series (XTinct).</li>
        </ul>
        <p style={{ ...metaLabel, fontSize: 11 }}>
          Verified content from wavewarz.info + official channels; details evolve.
        </p>
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

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}

function Link({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{ fontFamily: C.mono, fontSize: 13, padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.grid}`, background: C.bg, color: C.text, textDecoration: "none" }}>
      {label} &#8599;
    </a>
  );
}

const listStyle: React.CSSProperties = { margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 14 };
