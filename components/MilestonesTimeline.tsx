"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";
import { BATTLE_STATS } from "@/lib/battles";

type Battle = { date: string; vol: number; type: string; a: string };
const battles = battlesRaw as Battle[];

type Milestone = {
  date: string;
  label: string;
  detail: string;
  verified: boolean; // true = computed from ww-battles.json; false = from research docs
};

function buildMilestones(): Milestone[] {
  const sorted = [...battles].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Volume milestones — computed
  let cumVol = 0;
  const vol100Hit = { date: "" };
  const vol250Hit = { date: "" };
  let firstMain = "";
  let battle500 = "";
  let battle1000 = "";

  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    cumVol += b.vol ?? 0;
    if (!firstMain && b.type === "MAIN") firstMain = b.date;
    if (!vol100Hit.date && cumVol >= 100) vol100Hit.date = b.date;
    if (!vol250Hit.date && cumVol >= 250) vol250Hit.date = b.date;
    if (i === 499) battle500 = b.date;
    if (i === 999) battle1000 = b.date;
  }

  const raw: Milestone[] = [
    // Pre-data events (from research docs, marked unverified)
    {
      date: "Dec 2024",
      label: "ZAO-CHELLA IRL event",
      detail: "First WaveWarZ IRL event — Art Basel, Wynwood, Miami FL (Dec 6, 2024). Hurricane vs JANGO UU rematch, live audience.",
      verified: false,
    },
    {
      date: "Dec 2024",
      label: "PolyRaiders Holiday Heat",
      detail: "First charity battle series — 100% of battle proceeds to HuRya Empowerment Foundation.",
      verified: false,
    },
    {
      date: "Feb 2025",
      label: "Love Song Benefit Series",
      detail: "Second charity event. Combined with Holiday Heat: ~$1,497 raised for HuRya.",
      verified: false,
    },
    // Data-verified events
    {
      date: "May 28, 2025",
      label: "Platform opens",
      detail: "First battle on-chain recorded in the tracker. Community event: RaWavez vs StretchWavez.",
      verified: true,
    },
    {
      date: firstMain || "May 29, 2025",
      label: "First MAIN event",
      detail: "First MAIN-type battle — the highest-tier format with multi-round structure.",
      verified: true,
    },
    {
      date: vol100Hit.date || "Nov 2, 2025",
      label: "100 ◎ milestone",
      detail: "Cumulative trading volume crossed 100 SOL. Reached after 28 battles.",
      verified: true,
    },
    {
      date: battle500 || "Mar 16, 2026",
      label: "500th battle",
      detail: "Platform reached its 500th recorded battle, entering a period of accelerating growth.",
      verified: true,
    },
    {
      date: "03/2026",
      label: "Peak month: Mar 2026",
      detail: "Highest-volume month on record — 117.68 ◎ in a single calendar month.",
      verified: true,
    },
    {
      date: vol250Hit.date || "Mar 16, 2026",
      label: "250 ◎ milestone",
      detail: "Cumulative trading volume crossed 250 SOL tracked on-chain.",
      verified: true,
    },
    {
      date: battle1000 || "Jun 26, 2026",
      label: "1,000th battle",
      detail: "Platform crossed 1,000 total battles tracked. A milestone in platform longevity.",
      verified: true,
    },
    {
      date: "Jul 2026",
      label: "500 ◎ milestone",
      detail: "Cumulative platform volume crossed 500 SOL. Live platform total now exceeds the JSON tracker (which started May 2025).",
      verified: false,
    },
    {
      date: "Oct 3, 2026",
      label: "ZAOstock IRL event",
      detail: "Second confirmed IRL WaveWarZ + ZAO community event. Franklin St Parklet, Ellsworth ME. Upcoming.",
      verified: false,
    },
  ];

  // Sort chronologically (approximate — handles "Dec 2024", "Mar 2026" formats)
  return raw.sort((a, b) => {
    const parseDate = (s: string) => {
      if (/^\d{2}\/\d{4}$/.test(s)) {
        const [m, y] = s.split("/");
        return new Date(+y, +m - 1, 1).getTime();
      }
      const d = new Date(s);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    return parseDate(a.date) - parseDate(b.date);
  });
}

export default function MilestonesTimeline() {
  const milestones = useMemo(buildMilestones, []);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 16 }}>
        <span style={metaLabel}>PLATFORM MILESTONES</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          key events in WaveWarZ history — verified from on-chain data or community research
        </p>
      </div>

      <div style={{ position: "relative", paddingLeft: 20 }}>
        {/* vertical timeline line */}
        <div
          style={{
            position: "absolute",
            left: 7,
            top: 8,
            bottom: 8,
            width: 2,
            background: `${C.grid}`,
            borderRadius: 1,
          }}
        />

        {milestones.map((m, i) => (
          <div
            key={i}
            style={{
              position: "relative",
              paddingBottom: i < milestones.length - 1 ? 20 : 0,
            }}
          >
            {/* dot */}
            <div
              style={{
                position: "absolute",
                left: -16,
                top: 5,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: m.verified ? C.accent : C.dim,
                border: `2px solid ${m.verified ? C.accent : C.grid}`,
                boxShadow: m.verified ? `0 0 6px ${C.accent}55` : "none",
              }}
            />

            <div style={{ paddingLeft: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: C.mono,
                    fontSize: 11,
                    color: C.dim,
                    whiteSpace: "nowrap",
                    minWidth: 80,
                  }}
                >
                  {m.date}
                </span>
                <span
                  style={{
                    fontFamily: C.mono,
                    fontSize: 13,
                    color: m.verified ? C.text : C.dim,
                    fontWeight: m.verified ? 700 : 500,
                  }}
                >
                  {m.label}
                </span>
                {!m.verified && (
                  <span
                    style={{
                      fontFamily: C.mono,
                      fontSize: 10,
                      color: C.dim,
                      background: `${C.grid}30`,
                      border: `1px solid ${C.grid}`,
                      borderRadius: 3,
                      padding: "1px 5px",
                    }}
                  >
                    research doc
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: C.mono,
                  fontSize: 12,
                  color: C.dim,
                  lineHeight: 1.5,
                }}
              >
                {m.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          margin: "16px 0 0",
          color: C.dim,
          fontFamily: C.mono,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        Amber dots = verified from ww-battles.json · Dim dots = from community research docs (pre-data
        window or future). Live platform volume ({Math.round(BATTLE_STATS.totalVolumeSol)}+ ◎) exceeds JSON total because the tracker
        started May 2025; pre-launch activity is not captured.
      </p>
    </div>
  );
}
