import type { Metadata } from "next";
import { C } from "@/lib/theme";

export const metadata: Metadata = {
  title: "The ZAO — DAO Case Study | WaveWarZ Analytics",
  description:
    "Verified ZAO case study: 100+ Fractal governance weeks on Optimism, 1,291+ WaveWarZ battles on Solana, 878+ SOL volume (~$65K USD), $1,497 raised for charity. The ZAO is a decentralized impact network for independent music artists, founded by Zaal Panthaki.",
  openGraph: {
    title: "The ZAO — DAO Case Study (Jul 2026)",
    description:
      "100+ Fractal governance weeks · 1,291+ WaveWarZ battles · 878+ SOL volume · $1,497 charity · 157 on-chain Respect holders. Verified facts, July 2026.",
    url: "https://wwtracker.vercel.app/case-study",
    siteName: "wwtracker",
    type: "article",
  },
};

const FAQ_ITEMS = [
  {
    q: "What is The ZAO?",
    a: "The ZAO (ZTalent Artist Organization) is a decentralized impact network for independent music artists. It was founded by Zaal Panthaki (@bettercallzaal) and has run weekly Fractal governance sessions for over 100 consecutive weeks since July 2024. Respect (earned peer-ranking reputation) is settled as on-chain tokens on Optimism mainnet after each session — making 63 weeks of governance history publicly verifiable on-chain.",
  },
  {
    q: "What is WaveWarZ?",
    a: "WaveWarZ is The ZAO's flagship product: a live music-battle prediction market on Solana. Two songs compete head-to-head and fans trade SOL on the outcome. The winner is decided by best 2 of 3: community poll + SOL volume (charts) + DJ Wavy (AI judge). Artists earn 1% of every trade automatically and instantly onchain.",
  },
  {
    q: "What is the ZAO Fractal?",
    a: "The Fractal game is the weekly governance mechanism: members rank each other's contributions in small-group peer sessions. Rankings are aggregated into a consensus weighted by earned Respect. Each session's Respect allocation is settled on Optimism mainnet — 63 weeks of settlement are publicly verifiable via Blockscout (OG ERC-20: 0x34cE89baA7E4a4B00E17F7E4C0cb97105C216957, ZOR ERC-1155: 0x9885CCeEf7E8371Bf8d6f2413723D25917E7445c).",
  },
  {
    q: "Who founded The ZAO?",
    a: "The ZAO was founded by Zaal Panthaki (@bettercallzaal). WaveWarZ was incubated within The ZAO by co-founders including Hurricane, Candy, and Ohnahji. The full contributor roster is tracked via the ZAO's onchain Respect system — members with the highest cumulative Respect scores are the builders who have contributed most.",
  },
  {
    q: "What is ZABAL Gamez?",
    a: "ZABAL Gamez is The ZAO's 3-month builder cohort. Builders ship products or features for The ZAO community and keep earning from what they build even after the cohort ends. Open enrollment runs twice per year.",
  },
  {
    q: "How do I join The ZAO?",
    a: "Three paths: (1) Battle on WaveWarZ — artists who compete become part of the ZAO ecosystem. (2) Attend weekly Fractal governance calls (Farcaster Spaces, open to all) — active participants earn Respect over time. (3) Apply for ZABAL Gamez (2× per year). Community directory: thezao.com/community.",
  },
  {
    q: "How does The ZAO make money?",
    a: "WaveWarZ generates platform revenue: a 2.28% effective fee rate on total trading volume + automatic 1.53% artist payout rate on every trade. As of July 2026: 20.06 SOL platform revenue accumulated from 878+ SOL total volume (13.39 SOL to artists). No DAO treasury with a spending vote — revenue flows to operations and founders per a transparent on-chain split.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "The ZAO",
  alternateName: "ZTalent Artist Organization",
  url: "https://thezao.com",
  description:
    "Decentralized impact network for independent music artists. Founded by Zaal Panthaki. Flagship product: WaveWarZ (Solana music-battle prediction market).",
  founder: {
    "@type": "Person",
    name: "Zaal Panthaki",
    sameAs: ["https://x.com/bettercallzaal", "https://github.com/bettercallzaal"],
  },
  foundingDate: "2024",
  sameAs: [
    "https://x.com/thezaodao",
    "https://instagram.com/zaofestivals",
    "https://warpcast.com/~/channel/zao",
    "https://github.com/bettercallzaal/ZAOOS",
  ],
};

const CITABLE_FACTS = [
  { n: "100+", label: "Fractal governance weeks", detail: "Since Jul 30, 2024 · Respect on Optimism mainnet" },
  { n: "63", label: "on-chain settlement weeks", detail: "OG (33) + ZOR (31) · verified via Blockscout" },
  { n: "157", label: "Respect holders", detail: "122 OG · 56 ZOR · 21 dual · on Optimism mainnet" },
  { n: "1,291+", label: "WaveWarZ battles", detail: "On Solana · May 2025 – Jul 2026" },
  { n: "878+ SOL", label: "cumulative trading volume", detail: "~$65K USD · Jul 2026" },
  { n: "13.39 SOL", label: "artist payouts", detail: "Automatic · 1% per trade · 34 artists" },
  { n: "$1,497", label: "raised for charity", detail: "2 benefit-battle series · HuRya Empowerment Foundation" },
  { n: "2", label: "confirmed IRL events", detail: "ZAO-CHELLA (Art Basel Miami, Dec 2024) · ZAOstock (Ellsworth ME, Oct 2026)" },
];

export default function CaseStudyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "40px 20px 80px",
          color: C.text,
          fontFamily: "system-ui, -apple-system, sans-serif",
          lineHeight: 1.7,
        }}
      >
        <header style={{ marginBottom: 40 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: "0.12em", color: C.dim, fontFamily: C.mono }}>
            THE ZAO — VERIFIED JULY 2026
          </p>
          <h1 style={{ margin: "0 0 16px", fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 800, letterSpacing: "-0.02em", color: C.text, lineHeight: 1.15 }}>
            DAO Case Study
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: C.dim, maxWidth: 600 }}>
            The ZAO is a decentralized impact network for independent music artists — with 100+ weeks
            of on-chain governance, a live prediction-market product, and a verified track record in
            charity, community, and IP creation.
          </p>
        </header>

        {/* Citable facts grid */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            The numbers (verified Jul 2026)
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            {CITABLE_FACTS.map((f) => (
              <div
                key={f.n}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.grid}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: C.accent, lineHeight: 1.1 }}>
                  {f.n}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 0 2px", color: C.text }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>
                  {f.detail}
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: C.dim, fontFamily: C.mono }}>
            Sources: wavewarz.info/api/public/stats (battles/volume/payouts) · ZAOOS docs 1200–1202
            (Respect/settlement) · doc 1077 (case study) · doc 1214 (charity). All on-chain facts
            independently verifiable via Blockscout (Optimism) and Solana Explorer.
          </p>
        </section>

        {/* The canonical story */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>What is The ZAO</h2>
          <p style={{ margin: "0 0 14px", color: C.text }}>
            <strong>The ZAO (ZTalent Artist Organization)</strong> is a decentralized impact network for
            independent music artists, founded by Zaal Panthaki (
            <a href="https://x.com/bettercallzaal" style={{ color: C.accent }}>@bettercallzaal</a>
            ). It measures member contribution with{" "}
            <strong>Respect</strong> — a non-transferable weight earned by peer ranking in weekly Fractal
            governance sessions, not by holding tokens.
          </p>
          <p style={{ margin: "0 0 14px", color: C.text }}>
            The mission (verbatim from{" "}
            <a href="https://thezao.com" style={{ color: C.accent }}>thezao.com</a>
            ):{" "}
            <em>
              &ldquo;Empower independent creators by demystifying technology and providing the tools,
              knowledge, and support they need to take control of their work, data, and fan
              connections.&rdquo;
            </em>
          </p>
          <p style={{ margin: 0, color: C.text }}>
            The flagship product is <strong>WaveWarZ</strong> — live-traded music battles on Solana where
            artists are paid 1% of every trade instantly onchain. 1,291+ battles completed, 921 unique
            songs, 34 Audius-rostered artists, 878+ SOL total volume.
          </p>
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Common questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.q}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.grid}`,
                  borderRadius: 12,
                  padding: "16px 18px",
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: C.accent }}>
                  {item.q}
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: C.text, lineHeight: 1.65 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Links */}
        <section>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Follow + verify</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { href: "https://wavewarz.info", label: "WaveWarZ (live battles)" },
              { href: "https://wwtracker.vercel.app", label: "Analytics tracker" },
              { href: "https://thezao.com", label: "thezao.com" },
              { href: "https://x.com/thezaodao", label: "X @thezaodao" },
              { href: "https://warpcast.com/~/channel/zao", label: "Farcaster /zao" },
              { href: "https://github.com/bettercallzaal/ZAOOS", label: "ZAOOS research library" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                style={{
                  color: C.text,
                  background: C.panel,
                  border: `1px solid ${C.grid}`,
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontFamily: C.mono,
                  textDecoration: "none",
                }}
              >
                {l.label} ↗
              </a>
            ))}
          </div>
          <p style={{ margin: "20px 0 0", fontSize: 12, color: C.dim, fontFamily: C.mono }}>
            Unofficial community tool · not affiliated with WaveWarZ Ltd · not financial advice ·
            data verified 2026-07-25
          </p>
        </section>
      </main>
    </>
  );
}
