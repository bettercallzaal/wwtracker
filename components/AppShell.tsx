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
import Faq from "./Faq";

type View = "about" | "how" | "events" | "songs" | "artists" | "ecosystem" | "platform" | "analytics" | "trader" | "faq";

const isView = (v: string | null): v is View =>
  v === "about" || v === "how" || v === "events" || v === "songs" ||
  v === "artists" || v === "ecosystem" || v === "platform" ||
  v === "analytics" || v === "trader" || v === "faq";

export default function AppShell() {
  const [view, setView] = useState<View>("about");

  // Sync the active tab with ?tab= so a specific view is shareable.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (isView(t)) setView(t);
  }, []);

  const go = (v: View) => {
    setView(v);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", v);
    window.history.replaceState({}, "", u);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <nav
        role="tablist"
        aria-label="Dashboard view"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          background: C.panel,
          border: `1px solid ${C.grid}`,
          borderRadius: 12,
          padding: 6,
          alignSelf: "flex-start",
          maxWidth: "100%",
        }}
      >
        <Tab active={view === "about"} onClick={() => go("about")} label="ABOUT" />
        <Tab active={view === "how"} onClick={() => go("how")} label="HOW IT WORKS" />
        <Tab active={view === "events"} onClick={() => go("events")} label="EVENTS" />
        <Tab active={view === "songs"} onClick={() => go("songs")} label="SONGS" />
        <Tab active={view === "artists"} onClick={() => go("artists")} label="ARTISTS" />
        <Tab active={view === "ecosystem"} onClick={() => go("ecosystem")} label="ECOSYSTEM" />
        <Tab active={view === "platform"} onClick={() => go("platform")} label="PLATFORM FLOOR" />
        <Tab active={view === "analytics"} onClick={() => go("analytics")} label="ANALYTICS" />
        <Tab active={view === "trader"} onClick={() => go("trader")} label="MY TRADES" />
        <Tab active={view === "faq"} onClick={() => go("faq")} label="FAQ" />
      </nav>

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
