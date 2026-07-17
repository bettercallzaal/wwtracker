"use client";

import { C, metaLabel } from "@/lib/theme";
import { WW } from "@/lib/wwData";

// Verified WaveWarZ YouTube uploads (titles via oEmbed).
const VIDEOS: { id: string; title: string }[] = [
  { id: "cH-ehQhkCqo", title: "WaveWarZ Demo - Colosseum Frontier Hackathon (Solana)" },
  { id: "ODeO-Mi0bpk", title: "WaveWarZ Colosseum Frontier Hackathon Pitch" },
  { id: "VJUaD1s1ziU", title: "Colosseum by @r3plic4nt206 - music video (made with Claude Code by candy)" },
  { id: "FBsmFSA9TFg", title: "If Your Fans Aren't Spending Money, This is Why" },
  { id: "1gyD0NVSljE", title: "There's Always a Moment the Outcome is Obvious" },
];

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

      <Section label="CHARITY / BENEFIT BATTLES">
        <p style={{ margin: "0 0 10px", color: C.text, lineHeight: 1.6, fontSize: 14 }}>
          The crowd is the fundraiser - trades, votes, and SOL move from the arena
          to the cause, platform fees waived. Across <b>10 benefit battles</b>:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Stat label="ONCHAIN REDIRECTED" value="0.079 ◎" sub="fees + settlement" />
          <Stat label="VOLUME REDIRECTED" value="7.99 ◎" sub="across benefit battles" />
          <Stat label="FIAT RAISED" value="~$1,491" sub="cc / PayPal / Apple Pay" />
          <Stat label="GRAND TOTAL" value="~$1,497" sub="onchain + fiat" />
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
          Case study: the PolyRaiders Holiday Music Battle raised ~$270 in TradFi
          payments. IndieZ vs ClassicZ benefit series ran Feb 2026.
        </p>
      </Section>

      <Section label="WATCH (YOUTUBE)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {VIDEOS.slice(0, 2).map((v) => (
            <div key={v.id}>
              <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.grid}` }}>
                <iframe
                  title={v.title}
                  src={`https://www.youtube.com/embed/${v.id}`}
                  loading="lazy"
                  allow="encrypted-media; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              </div>
              <p style={{ margin: "6px 0 0", fontFamily: C.mono, fontSize: 12, color: C.dim, lineHeight: 1.4 }}>{v.title}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {VIDEOS.slice(2).map((v) => (
            <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer" style={{ color: C.text, fontFamily: C.mono, fontSize: 12, textDecoration: "none" }}>
              &#8226; {v.title} <span style={{ color: C.accent }}>&#8599;</span>
            </a>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <Link href="https://www.youtube.com/@WaveWarZ" label="More on YouTube" />
        </div>
      </Section>

      <Section label="OFFICIAL ON AUDIUS">
        <p style={{ margin: "0 0 10px", color: C.text, lineHeight: 1.6, fontSize: 14 }}>
          The official <a href="https://audius.co/WaveWarZ" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>@WaveWarZ</a> Audius
          account - featuring a VeggieWavez x Hurric4n3Ike (founder) track.
        </p>
        <iframe
          title="VeggieWavez x Hurric4n3Ike"
          src="https://audius.co/embed/track/MpMJygj?flavor=compact"
          width="100%"
          height={120}
          loading="lazy"
          allow="encrypted-media"
          style={{ border: "none", borderRadius: 8 }}
        />
      </Section>

      <Section label="THIRD-PARTY COVERAGE">
        <p style={{ margin: "0 0 10px", color: C.text, lineHeight: 1.6, fontSize: 14 }}>
          Independent media and community coverage — verified via YouTube oEmbed.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <a
            href="https://www.youtube.com/watch?v=rx0PeGv8lPI"
            target="_blank"
            rel="noreferrer"
            style={{ color: C.text, fontFamily: C.mono, fontSize: 12, textDecoration: "none" }}
          >
            &#8226; Crypto Magic Hour EP. 50 — @VeVeMagic (⭕️VeVeMagic🏰){" "}
            <span style={{ color: C.accent }}>&#8599;</span>
          </a>
        </div>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 10 }}>
          Not affiliated with WaveWarZ. Independent third-party coverage. Verified 2026-07-17.
        </p>
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
