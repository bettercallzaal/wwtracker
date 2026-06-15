"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/theme";
import { WW } from "@/lib/wwData";
import BalanceDashboard from "./BalanceDashboard";
import TraderScorecard from "./TraderScorecard";
import PlatformAnalytics from "./PlatformAnalytics";
import AboutWaveWarZ from "./AboutWaveWarZ";
import HowItWorks from "./HowItWorks";
import Ecosystem from "./Ecosystem";
import Events from "./Events";
import Songs from "./Songs";
import Artists from "./Artists";
import Music from "./Music";
import Faq from "./Faq";

type View = "about" | "how" | "events" | "songs" | "artists" | "music" | "ecosystem" | "platform" | "analytics" | "trader" | "faq";

const GROUPS: { label: string; tabs: [View, string][] }[] = [
  { label: "INFO", tabs: [["about", "ABOUT"], ["how", "HOW IT WORKS"], ["events", "EVENTS"], ["faq", "FAQ"]] },
  { label: "MUSIC", tabs: [["songs", "SONGS"], ["artists", "ARTISTS"], ["music", "MUSIC"]] },
  { label: "ON-CHAIN", tabs: [["platform", "PLATFORM FLOOR"], ["analytics", "ANALYTICS"], ["trader", "MY TRADES"]] },
  { label: "ZAO", tabs: [["ecosystem", "ECOSYSTEM"]] },
];

const isView = (v: string | null): v is View =>
  v === "about" || v === "how" || v === "events" || v === "songs" ||
  v === "artists" || v === "music" || v === "ecosystem" || v === "platform" ||
  v === "analytics" || v === "trader" || v === "faq";

export default function AppShell() {
  const [view, setView] = useState<View>("about");
  const [navOpen, setNavOpen] = useState(true);

  // Sync the active tab with ?tab= so a specific view is shareable.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (isView(t)) setView(t);
    if (window.innerWidth < 640) setNavOpen(false);
  }, []);

  const go = (v: View) => {
    setView(v);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", v);
    window.history.replaceState({}, "", u);
    if (window.innerWidth < 640) setNavOpen(false);
  };

  const currentLabel = GROUPS.flatMap((g) => g.tabs).find(([v]) => v === view)?.[1] ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={() => setNavOpen((o) => !o)}
          aria-expanded={navOpen}
          aria-label="Toggle navigation"
          style={{ fontFamily: C.mono, fontSize: 12, padding: "8px 12px", borderRadius: 9, border: `1px solid ${C.grid}`, background: C.panel, color: C.text, cursor: "pointer" }}
        >
          {navOpen ? "close menu" : "menu"}
        </button>
        <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>{currentLabel}</span>
      </div>

      {navOpen && (
      <nav
        aria-label="Dashboard view"
        style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}
      >
        {GROUPS.map((g) => (
          <div
            key={g.label}
            style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 6, display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span style={{ fontFamily: C.mono, fontSize: 9, letterSpacing: "0.1em", color: C.dim, padding: "2px 8px" }}>{g.label}</span>
            <div role="tablist" aria-label={g.label} style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {g.tabs.map(([v, label]) => (
                <Tab key={v} active={view === v} onClick={() => go(v)} label={label} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      )}

      <div role="tabpanel" aria-label={`${view} view`}>
        {view === "about" ? (
          <AboutWaveWarZ />
        ) : view === "how" ? (
          <HowItWorks />
        ) : view === "events" ? (
          <Events />
        ) : view === "songs" ? (
          <Songs />
        ) : view === "artists" ? (
          <Artists />
        ) : view === "music" ? (
          <Music />
        ) : view === "ecosystem" ? (
          <Ecosystem />
        ) : view === "platform" ? (
          <BalanceDashboard />
        ) : view === "analytics" ? (
          <PlatformAnalytics />
        ) : view === "trader" ? (
          <TraderScorecard />
        ) : (
          <Faq />
        )}
      </div>

      <footer
        style={{
          marginTop: 8,
          paddingTop: 16,
          borderTop: `1px solid ${C.grid}`,
          color: C.dim,
          fontFamily: C.mono,
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        On-chain analytics from Dune over program 9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo.
        Treasury balance is live; analytics snapshot {WW.generatedAt || "pending"}.
        Unofficial community tool - not financial advice.{" "}
        <a href="https://github.com/bettercallzaal/wwtracker" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
          source
        </a>
      </footer>
    </div>
  );
}

function Tab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        fontFamily: C.mono,
        fontSize: 12,
        letterSpacing: "0.06em",
        padding: "9px 16px",
        borderRadius: 8,
        cursor: "pointer",
        border: "none",
        background: active ? C.accent : "transparent",
        color: active ? "#1a1206" : C.text,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}
