"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { C } from "@/lib/theme";
import { DATA_AS_OF } from "@/lib/freshness";
import BalanceDashboard from "./BalanceDashboard";
import OnChainProof from "./OnChainProof";
import PlatformGrowth from "./PlatformGrowth";
import PlatformAnalytics from "./PlatformAnalytics";
import Profitability from "./Profitability";
import WeeklyRevenueAnalytics from "./WeeklyRevenueAnalytics";
import OpsLedger from "./OpsLedger";
import AboutWaveWarZ from "./AboutWaveWarZ";
import HowItWorks from "./HowItWorks";
import Ecosystem from "./Ecosystem";
import Events from "./Events";
import Artists from "./Artists";
import Music from "./Music";
import TraderEdge from "./TraderEdge";
import FeeModel from "./FeeModel";
import EmbedsSection from "./EmbedsSection";
import Faq from "./Faq";

// The dashboard is one top-to-bottom read: what WaveWarZ is, then the treasury
// floor, then the money model, then the full on-chain picture, then the ways to
// take it elsewhere.
//
// WHAT IS DELIBERATELY NOT HERE. There used to be a battles table, a song chart
// and a trader leaderboard. wavewarz.info already renders all three, from the
// database that is their system of record, and ours were copies - which meant
// ours could disagree with theirs, and did: the baked trader table showed the
// top trader down 19 SOL while the platform had them up 30. A second set of
// numbers for the same thing is a liability, not a feature. Those sections are
// gone and the ecosystem section links out instead.
//
// What is left is the part no other WaveWarZ surface has: the treasury, the
// operating floor, the fee model, the business ledger, and the program decoded
// straight off Solana.
type Section = {
  id: string;
  n: string;
  title: string;
  intro: string;
  render: () => ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "overview",
    n: "00",
    title: "The whole run, at a glance",
    intro: "every on-chain series in one place - volume, treasury, battles, trades. each line is scaled to its own peak so they share one axis; toggle any of them and hover for the real number.",
    render: () => <OnChainProof />,
  },
  {
    id: "what",
    n: "01",
    title: "What WaveWarZ is",
    intro: "start here. what the platform is, and how a single song-vs-song battle actually plays out on-chain.",
    render: () => (
      <>
        <AboutWaveWarZ />
        <div style={{ height: 24 }} />
        <HowItWorks />
      </>
    ),
  },
  {
    id: "floor",
    n: "02",
    title: "The treasury floor",
    intro: "the headline. the platform wallet's daily balance held against a 3.5 SOL operating floor - live from Dune, refreshed every morning.",
    render: () => <BalanceDashboard />,
  },
  {
    id: "growth",
    n: "03",
    title: "Growth over time",
    intro: "cumulative SOL traded since the platform's first battle in May 2025 - the real shape, at true scale.",
    render: () => <PlatformGrowth />,
  },
  {
    id: "economics",
    n: "04",
    title: "Where every SOL goes",
    intro: "the fee schedule made visible: 1.5% per trade split two-to-one in the artist's favour, the settlement waterfall, and the skip-queue auction.",
    render: () => <FeeModel />,
  },
  {
    id: "profitability",
    n: "05",
    title: "Profitability + the split",
    intro: "once the wallet is past the floor, the excess distributes: 33% operations, 22% each to Hurricane / Candy / Zaal.",
    render: () => <Profitability />,
  },
  {
    id: "revenue",
    n: "06",
    title: "Weekly revenue analytics",
    intro: "real weekly inflow to the on-chain fee wallet - this week's revenue, the trend, and the per-battle fee.",
    render: () => <WeeklyRevenueAnalytics />,
  },
  {
    id: "ops",
    n: "07",
    title: "Running the business",
    intro: "real-world costs and income the team tracks manually - tech stack, monthly P&L, the fee wallet. not on-chain-derivable, so treat it as reported.",
    render: () => <OpsLedger />,
  },
  {
    id: "analytics",
    n: "08",
    title: "The program itself",
    intro: "every call to the Solana program, decoded by Anchor discriminator, from its first day. no other WaveWarZ surface shows this.",
    render: () => <PlatformAnalytics />,
  },
  {
    id: "market",
    n: "09",
    title: "Reading the market",
    intro: "when the money shows up, which artists pull it in, and how often the crowd is right - measured across every battle rather than picked out by hand.",
    render: () => <TraderEdge />,
  },
  {
    id: "embeds",
    n: "10",
    title: "Take it with you",
    intro: "every chart here is a standalone iframe. one line, no key, themed to match - drop them anywhere in the ecosystem.",
    render: () => <EmbedsSection />,
  },
  {
    id: "ecosystem",
    n: "11",
    title: "In the ZAO ecosystem",
    intro: "where WaveWarZ sits in the bigger picture, the artists behind the battles, what's coming up, and the questions people ask most.",
    render: () => (
      <>
        <Ecosystem />
        <div style={{ height: 24 }} />
        <Artists />
        <div style={{ height: 24 }} />
        <Music />
        <div style={{ height: 24 }} />
        <Events />
        <div style={{ height: 24 }} />
        <Faq />
      </>
    ),
  },
];

// Old ?tab= deep links keep working - map each legacy tab to its new section.
const LEGACY_TAB: Record<string, string> = {
  overview: "overview",
  about: "what", how: "what",
  platform: "floor",
  growth: "growth",
  profitability: "profitability",
  analytics: "analytics",
  // Sections that no longer exist here land on the nearest thing that does,
  // rather than 404ing a link somebody may have shared. Battles and the song
  // chart now live on wavewarz.info; the ecosystem section links out to them.
  battles: "analytics",
  songs: "ecosystem",
  leaderboard: "market", traders: "market", trader: "market", wallet: "market",
  artists: "ecosystem", music: "ecosystem",
  ecosystem: "ecosystem", events: "ecosystem", faq: "ecosystem",
};

export default function AppShell() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  // Jump to the section named by ?tab= or #hash on first load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const hash = window.location.hash.replace("#", "");
    const target = (tab && LEGACY_TAB[tab]) || (hash && SECTIONS.some((s) => s.id === hash) ? hash : "");
    if (target) {
      const el = document.getElementById(target);
      if (el) window.requestAnimationFrame(() => el.scrollIntoView({ behavior: "auto", block: "start" }));
    }
  }, []);

  // Track which section is in view to highlight the jump-nav.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    const u = new URL(window.location.href);
    u.hash = id;
    window.history.replaceState({}, "", u);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <nav
        aria-label="Jump to section"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          gap: 6,
          overflowX: "auto",
          padding: "10px 2px",
          margin: "0 -2px",
          background: `${C.bg}f2`,
          backdropFilter: "blur(6px)",
          borderBottom: `1px solid ${C.grid}`,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jump(s.id)}
            aria-current={active === s.id}
            style={{
              flex: "0 0 auto",
              fontFamily: C.mono,
              fontSize: 11,
              letterSpacing: "0.04em",
              padding: "7px 12px",
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${active === s.id ? C.accent : C.grid}`,
              background: active === s.id ? C.accent : "transparent",
              color: active === s.id ? "#1a1206" : C.dim,
              fontWeight: active === s.id ? 600 : 400,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ opacity: 0.6, marginRight: 6 }}>{s.n}</span>
            {s.title}
          </button>
        ))}
      </nav>

      {SECTIONS.map((s, i) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-h`}
          style={{ scrollMarginTop: 64, paddingTop: i === 0 ? 8 : 40 }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
            <span style={{ fontFamily: C.mono, fontSize: 13, color: C.accent, fontWeight: 700 }}>{s.n}</span>
            <h2 id={`${s.id}-h`} style={{ margin: 0, fontSize: 20, color: C.text, fontWeight: 700 }}>
              {s.title}
            </h2>
          </div>
          <p style={{ margin: "0 0 18px", color: C.dim, fontSize: 13, lineHeight: 1.6, maxWidth: 640 }}>
            {s.intro}
          </p>
          <Reveal eager={i < 2}>{s.render()}</Reveal>
        </section>
      ))}

      <footer
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: `1px solid ${C.grid}`,
          color: C.dim,
          fontFamily: C.mono,
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        On-chain analytics from Dune over program 9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo.
        Treasury balance + Audius are live; baked data as of {DATA_AS_OF}.
        Unofficial community tool - not financial advice.{" "}
        <a href="https://github.com/bettercallzaal/wwtracker" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
          source
        </a>
        {" / "}
        <a href="/overlay.html" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
          streaming overlay
        </a>
      </footer>
    </div>
  );
}

// Mounts its children only once they scroll near the viewport, so the page stays
// light on load and each chapter fills in as you reach it. The first sections
// render eagerly so the top of the page is never blank.
function Reveal({ eager, children }: { eager: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(eager);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shown]);

  if (shown) return <>{children}</>;
  return (
    <div ref={ref} aria-hidden style={{ minHeight: 240, display: "grid", placeItems: "center", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
      loading...
    </div>
  );
}
