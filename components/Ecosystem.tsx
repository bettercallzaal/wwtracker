"use client";

import { C, metaLabel } from "@/lib/theme";

interface Brand {
  name: string;
  what: string;
  href?: string;
}

const BRANDS: Brand[] = [
  {
    name: "The ZAO",
    what: "The foundation layer - a web3 music/creator collective. Provides festivals, governance, and cultural infrastructure; WaveWarZ is its music-battle application layer.",
  },
  {
    name: "BetterCallZaal (BCZ)",
    what: "Zaal's founder/brand identity at the top of the BCZ -> ZAO -> WaveWarZ stack.",
    href: "https://x.com/bettercallzaal",
  },
  {
    name: "ZABAL",
    what: "Streaming + coordination engine across the ecosystem. Staking via the $SANG token with alignment-focused rewards.",
  },
  {
    name: "SongJam (SANG)",
    what: "Leaderboard + Web2-to-Farcaster infrastructure; tracks ecosystem mentions with multiplier staking.",
    href: "https://www.songjam.space",
  },
  {
    name: "ZAO Fractals",
    what: "Weekly community governance ritual built on contribution and recognition (the Respect Game).",
  },
  {
    name: "ZAO Stock",
    what: "The long-term vision: a physical Maine-based event amplified by the ecosystem.",
    href: "https://zaostock.com",
  },
];

export default function Ecosystem() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / ecosystem</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          WaveWarZ is the music-battle app inside a larger creator ecosystem:
          <b> BCZ -&gt; The ZAO -&gt; WaveWarZ</b>. The surfaces below feed and
          amplify each other.
        </p>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {BRANDS.map((b) => (
          <div
            key={b.name}
            style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{b.name}</h2>
              {b.href && (
                <a href={b.href} target="_blank" rel="noreferrer" style={{ color: C.accent, fontFamily: C.mono, fontSize: 12, textDecoration: "none" }}>
                  visit &#8599;
                </a>
              )}
            </div>
            <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, fontSize: 14 }}>{b.what}</p>
          </div>
        ))}
      </section>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Ecosystem context from research; see docs/WAVEWARZ-RESEARCH.md. Some
        details evolve - treat as a snapshot.
      </p>
    </div>
  );
}
