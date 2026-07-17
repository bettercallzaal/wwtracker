"use client";

import { C, metaLabel } from "@/lib/theme";

// Community-verified sources (research/wavewarz/2026-07-15-* + PR #77 verified 2026-07-17):
//   YouTube @wavewarz — confirmed from wavewarz.info direct fetch
//   Telegram wavewarzclipshq — confirmed from wavewarz.info direct fetch
//   X/Twitter — listed on wavewarz.info
//   Audius — artists active on audius.co (live from Music section)

interface Channel {
  label: string;
  what: string;
  href: string;
  tag: string;
}

const CHANNELS: Channel[] = [
  {
    label: "X / Twitter",
    what: "Official WaveWarZ account — battle announcements, artist spotlights, community posts.",
    href: "https://x.com/WaveWarZ",
    tag: "social",
  },
  {
    label: "YouTube @wavewarz",
    what: "WaveWarZ Artist Interview series + live battle streams. Confirmed active channel.",
    href: "https://youtube.com/@wavewarz",
    tag: "media",
  },
  {
    label: "WaveWarZ Clips HQ",
    what: "Telegram channel for community highlights and battle clips. Handle: @wavewarzclipshq.",
    href: "https://t.me/wavewarzclipshq",
    tag: "community",
  },
  {
    label: "Audius (artists)",
    what: "WaveWarZ artists publish their battle tracks on Audius — free streaming, no paywall.",
    href: "https://audius.co",
    tag: "music",
  },
  {
    label: "wavewarz.info",
    what: "Live analytics platform — battle feed, leaderboards, artist stats, public stats API.",
    href: "https://wavewarz.info",
    tag: "analytics",
  },
  {
    label: "wavewarz.com",
    what: "Main product site — join battles, track live odds, claim winnings.",
    href: "https://wavewarz.com",
    tag: "platform",
  },
];

const TAG_COLOR: Record<string, string> = {
  social: "#8ab4ff",
  media: "#c9a0ff",
  community: "#7ef5b0",
  music: "#f9a8d4",
  analytics: "#fcd34d",
  platform: "#fb923c",
};

export default function WwMedia() {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>WAVEWARZ — COMMUNITY & MEDIA</span>
        <p style={{ margin: "6px 0 0", fontFamily: C.mono, fontSize: 12, color: C.dim }}>
          Verified community surfaces and official links (sources: wavewarz.info, research 2026-07-17)
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
        {CHANNELS.map((ch) => (
          <a
            key={ch.label}
            href={ch.href}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", display: "block" }}
          >
            <div
              style={{
                background: C.elev,
                border: `1px solid ${C.grid}`,
                borderRadius: 12,
                padding: 14,
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontFamily: C.mono,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#1a1206",
                    background: TAG_COLOR[ch.tag] ?? C.accent,
                    borderRadius: 4,
                    padding: "2px 6px",
                    flexShrink: 0,
                  }}
                >
                  {ch.tag.toUpperCase()}
                </span>
                <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 600, color: C.accent }}>
                  {ch.label} &#8599;
                </span>
              </div>
              <p style={{ margin: 0, fontFamily: C.mono, fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
                {ch.what}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
