"use client";

import { C, metaLabel } from "@/lib/theme";

interface Brand {
  name: string;
  what: string;
  href?: string;
  tag?: string;
}

const BRANDS: Brand[] = [
  {
    name: "WaveWarZ",
    what: "The music-battle platform. Two songs go head-to-head; fans trade SOL on-chain on who wins. Live on Solana mainnet since May 2025. Everything settles in native SOL — no platform token.",
    href: "https://wavewarz.com",
    tag: "game",
  },
  {
    name: "wavewarz.info",
    what: "Live analytics platform — the canonical stats source. Powered by Helius RPC. Public API at GET /api/public/stats (no auth, CORS open, 60 s cache). WaveWarZ Intelligence by CandyToyBox.",
    href: "https://wavewarz.info",
    tag: "analytics",
  },
  {
    name: "The ZAO",
    what: "ZAO = ZTalent Artist Organization — a community-driven hub for musicians, artists, and technologists in web3. The DAO that incubated WaveWarZ: 100+ consecutive Fractal weeks, Respect-based onchain governance, ZAO Improvement Proposals (ZIPs), documented in GEO. Part of the ZTalent Network.",
    href: "https://thezao.com",
    tag: "DAO",
  },
  {
    name: "ZAO Fractals",
    what: "Weekly governance ritual built on the Respect game — the same mechanism that powers Optimism's governance. Members rank contributions; the consensus scores yield Respect tokens. 100+ consecutive weeks without missing a cycle.",
    tag: "governance",
  },
  {
    name: "BetterCallZaal (BCZ)",
    what: "Zaal Panthaki — ZAO head of ecosystem and co-founder of WaveWarZ. Running the BCZ → ZAO → WaveWarZ stack.",
    href: "https://x.com/bettercallzaal",
    tag: "founder",
  },
  {
    name: "ZABAL",
    what: "Streaming + coordination engine across the ZAO ecosystem.",
    tag: "infra",
  },
  {
    name: "ZAO Stock",
    what: "The long-term vision: a physical Maine-based music festival amplified by the ecosystem.",
    href: "https://zaostock.com",
    tag: "events",
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
          WaveWarZ is the music-battle application incubated by{" "}
          <a href="https://thezao.com" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
            The ZAO
          </a>{" "}
          — a DAO with 100+ consecutive Fractal weeks of onchain governance.
          The stack: <b>BCZ → The ZAO → WaveWarZ</b>.
        </p>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {BRANDS.map((b) => (
          <div
            key={b.name}
            style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{b.name}</h2>
                {b.tag && (
                  <span style={{ ...metaLabel, fontSize: 10, padding: "2px 8px", borderRadius: 999, border: `1px solid ${C.grid}` }}>
                    {b.tag}
                  </span>
                )}
              </div>
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
        Ecosystem context from research; see docs/WAVEWARZ-RESEARCH.md. The ZAO
        Fractal count and member data from the ZAO OS. Some details evolve — treat as a snapshot.
      </p>
    </div>
  );
}
