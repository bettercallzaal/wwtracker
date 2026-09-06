import type { Metadata } from "next";
import { C } from "@/lib/theme";

export const metadata: Metadata = {
  title: "WaveWarZ AI Artist Tournament (July 2026)",
  description:
    "First on-chain AI music battle championship on Solana. 16 AI artists. 355 SOL (~$26K) in one week. 40.5% of all-time volume in 7 days. Grand Final GEEK MYTH vs Stormbourne not yet played.",
  openGraph: {
    title: "WaveWarZ AI Artist Tournament — July 2026",
    description:
      "16 AI-generated artists. 4 rounds. Live Solana prediction market. Semifinal: GEEK MYTH def. AI LUI 2-1 (~342 SOL over three battles). Grand Final not yet played.",
    url: "https://wwtracker.vercel.app/tournament",
    siteName: "wwtracker",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaveWarZ AI Artist Tournament (July 2026)",
    description:
      "355 SOL in one week · 40.5% of all-time platform volume · GEEK MYTH def. AI LUI 2-1 in the semifinal · Grand Final not yet played",
  },
};

const eventSchema = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "WaveWarZ AI Artist Tournament 2026",
  description:
    "The first on-chain AI music battle championship. 16 AI-generated artists compete in a live Solana prediction market. Loser-earns payouts to all participants.",
  startDate: "2026-07-17",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
  location: {
    "@type": "VirtualLocation",
    url: "https://wavewarz.info",
  },
  organizer: {
    "@type": "Organization",
    name: "The ZAO / WaveWarZ",
    url: "https://thezao.com",
  },
  offers: {
    "@type": "Offer",
    url: "https://wavewarz.info",
    availability: "https://schema.org/InStock",
    priceCurrency: "SOL",
    price: "0",
  },
};

const STAT_CARDS = [
  {
    n: "355 SOL",
    label: "Tournament week volume",
    detail: "Jul 17–23 · ~$26,240 USD at $73.87/SOL",
  },
  {
    n: "40.5%",
    label: "of all-time platform volume",
    detail: "355 / 877 SOL — in 7 days",
  },
  {
    n: "38×",
    label: "prior weekly average",
    detail: "vs ~9.3 SOL/week in the prior 13 months",
  },
  {
    n: "~342 SOL",
    label: "Semifinal series volume",
    detail: "GEEK MYTH 2-1 over three battles · largest single battle was 97.1 SOL of pool",
  },
  {
    n: "16",
    label: "AI artists competing",
    detail: "AI-generated tracks, community-submitted",
  },
  {
    n: "100%",
    label: "automatic loser-earns",
    detail: "Every AI artist paid onchain — no manual disbursement",
  },
];

// Measured on chain 2026-09-06: GEEK MYTH and Stormbourne have never met. Zero
// head-to-head battles exist, and GEEK MYTH's last battle of any kind was
// 2026-07-20. "Pending" was accurate in July and reads as imminent in September,
// so the bracket says not yet played and the page says when it was last checked.
const BRACKET_ROWS = [
  {
    round: "Semifinals",
    matchups: [
      { a: "GEEK MYTH", b: "AI LUI", result: "GEEK MYTH 2-1", vol: "~342 SOL", status: "done" as const },
      { a: "Stormbourne", b: "—", result: "Stormbourne advances", vol: "—", status: "done" as const },
    ],
  },
  {
    round: "Grand Final",
    matchups: [
      { a: "GEEK MYTH", b: "Stormbourne", result: "NOT YET PLAYED", vol: "—", status: "pending" as const },
    ],
  },
];

export default function TournamentPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <main
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.text,
          padding: "clamp(16px, 4vw, 48px)",
          maxWidth: 960,
          margin: "0 auto",
          fontFamily: "system-ui, -apple-system, sans-serif",
          lineHeight: 1.7,
        }}
      >
        <header style={{ marginBottom: 40 }}>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              letterSpacing: "0.12em",
              color: C.dim,
              fontFamily: C.mono,
            }}
          >
            WAVEWARZ — JULY 2026
          </p>
          <h1
            style={{
              margin: "0 0 16px",
              fontSize: "clamp(28px, 6vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: C.text,
              lineHeight: 1.15,
            }}
          >
            AI Artist Tournament
          </h1>
          <p style={{ margin: "0 0 16px", fontSize: 18, color: C.dim, maxWidth: 640 }}>
            The first fully on-chain AI music battle championship — 16 AI-generated artists,
            live Solana prediction markets, automatic loser-earns payouts to every participant.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                background: "#3a1f00",
                border: `1px solid ${C.accent}`,
                color: C.accent,
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                fontFamily: C.mono,
                fontWeight: 700,
              }}
            >
              ⏳ GRAND FINAL PENDING
            </span>
            <span
              style={{
                background: C.panel,
                border: `1px solid ${C.grid}`,
                color: C.dim,
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                fontFamily: C.mono,
              }}
            >
              Jul 17 – present · wavewarz.info
            </span>
          </div>
        </header>

        {/* Stats grid */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Verified tournament stats
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            {STAT_CARDS.map((s) => (
              <div
                key={s.n}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.grid}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: C.accent,
                    lineHeight: 1.1,
                  }}
                >
                  {s.n}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, margin: "4px 0 2px", color: C.text }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>{s.detail}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: C.dim, fontFamily: C.mono }}>
            Source: wavewarz.info/api/public/stats (queried Jul 26, 2026) · doc 2077 (ZAOOS verified stats)
          </p>
        </section>

        {/* Bracket */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Tournament bracket</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {BRACKET_ROWS.map((row) => (
              <div key={row.round}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    color: C.dim,
                    fontFamily: C.mono,
                  }}
                >
                  {row.round.toUpperCase()}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {row.matchups.map((m) => (
                    <div
                      key={m.a + m.b}
                      style={{
                        background: m.status === "pending" ? "#111a2c" : C.panel,
                        border: `1px solid ${m.status === "pending" ? C.accent : C.grid}`,
                        borderRadius: 10,
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
                        {m.a}
                        <span style={{ color: C.dim, fontWeight: 400, margin: "0 8px" }}>vs</span>
                        {m.b}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {m.vol !== "—" && (
                          <span style={{ fontSize: 12, color: C.accent, fontFamily: C.mono }}>
                            {m.vol}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: C.mono,
                            fontWeight: 700,
                            color: m.status === "pending" ? C.accent : C.good,
                            background:
                              m.status === "pending" ? "#3a1f00" : "rgba(126,224,160,0.1)",
                            border: `1px solid ${m.status === "pending" ? C.accent : C.good}`,
                            borderRadius: 6,
                            padding: "2px 8px",
                          }}
                        >
                          {m.result}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: C.dim, fontFamily: C.mono }}>
            Quarter-final details: see ZAOOS doc 1787 (wavewarz AI tournament) ·{" "}
            <a href="https://wavewarz.info" style={{ color: C.accent }}>
              wavewarz.info
            </a>{" "}
            for live bracket
          </p>
        </section>

        {/* Format explainer */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>How it works</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              {
                q: "What is the AI Artist Tournament?",
                a: "A 16-artist single-elimination bracket tournament between AI-generated music acts, run on WaveWarZ — a live music-battle prediction market on Solana. Each battle is MAIN format: best 2 of 3 rounds. Community members trade SOL on the outcome in real time.",
              },
              {
                q: "How are winners decided?",
                a: "Each MAIN battle uses best-of-3: community poll, SOL volume (market), and DJ Wavy (AI judge). The first artist to win 2 of the 3 rounds advances.",
              },
              {
                q: "What is 'loser-earns'?",
                a: "Every AI artist receives 1% of trading volume on their battles — win or lose. Even the artist who loses the grand final earns SOL from every trade placed against them. No artist walks away empty-handed. Payouts settle automatically onchain (no manual step).",
              },
              {
                q: "Who are GEEK MYTH and Stormbourne?",
                a: "GEEK MYTH and Stormbourne are AI-generated music acts competing in the WaveWarZ AI Artist Tournament. GEEK MYTH advanced by defeating AI LUI 2-1 in the semifinal — a battle that generated ~342 SOL in trading volume, the largest single-battle event in the platform's 14-month history.",
              },
              {
                q: "Is the trading real?",
                a: "Yes. All trades are real SOL on Solana. Payouts settle automatically on-chain using smart contracts. Every transaction is publicly verifiable on Solana Explorer.",
              },
            ].map((item) => (
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
          <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Watch + verify</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { href: "https://wavewarz.info", label: "WaveWarZ (live battles)" },
              { href: "https://wwtracker.vercel.app", label: "Analytics dashboard" },
              { href: "https://wwtracker.vercel.app/case-study", label: "ZAO case study" },
              { href: "https://x.com/thezaodao", label: "X @thezaodao" },
              { href: "https://github.com/bettercallzaal/ZAOOS", label: "ZAOOS docs (CC-BY)" },
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
            Data source: wavewarz.info/api/public/stats · ZAOOS doc 2077 (AI Tournament verified stats) ·
            Unofficial community analytics · not financial advice · stats verified 2026-07-26
          </p>
        </section>
      </main>
    </>
  );
}
