"use client";

import { useMemo, useState } from "react";
import { EMBEDS, EMBED_CATEGORIES, sortedEmbeds, type EmbedWidget } from "@/lib/embeds";
import { FONTS } from "@/lib/embedTheme";
import { C } from "@/lib/theme";

// The gallery. Pick a widget, see it live, copy the iframe.
//
// This page is wwtracker's own surface, so it wears wwtracker's colors
// (lib/theme.ts). The PREVIEW inside each card is a real iframe pointed at the
// real /embed route, so what a partner sees here is exactly what lands on their
// page - no mockups, no screenshots that drift from the code.

const ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://wwtracker.vercel.app";

type Theme = "dark" | "light";

function snippet(w: EmbedWidget, theme: Theme, transparent: boolean, accent: string): string {
  const q: string[] = [];
  if (theme === "light") q.push("theme=light");
  if (transparent) q.push("transparent=1");
  if (accent) q.push(`accent=${accent.replace("#", "")}`);
  const qs = q.length ? `?${q.join("&")}` : "";
  return `<iframe
  src="${ORIGIN}/embed/${w.slug}${qs}"
  title="${w.title} - WaveWarZ on-chain"
  width="100%"
  height="${w.height}"
  loading="lazy"
  style="border:0;border-radius:16px;overflow:hidden"
></iframe>`;
}

export default function EmbedGallery() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [transparent, setTransparent] = useState(false);
  const [accent, setAccent] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [copied, setCopied] = useState<string | null>(null);

  const shown = useMemo(() => {
    const all = sortedEmbeds();
    return category === "All" ? all : all.filter((w) => w.category === category);
  }, [category]);

  const copy = async (w: EmbedWidget) => {
    try {
      await navigator.clipboard.writeText(snippet(w, theme, transparent, accent));
      setCopied(w.slug);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard is permission-gated; the snippet is visible in the card
      // anyway, so a failure here costs the user nothing but a manual select.
      setCopied(null);
    }
  };

  const exclusiveCount = EMBEDS.filter((w) => w.exclusive).length;

  return (
    <main
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        padding: "48px 20px 80px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ ...label, marginBottom: 10 }}>WWTRACKER / EMBEDS</p>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(26px, 5vw, 40px)",
            lineHeight: 1.1,
            letterSpacing: "-.02em",
          }}
        >
          Put any WaveWarZ chart on any page
        </h1>
        <p style={{ maxWidth: "62ch", color: C.dim, lineHeight: 1.65, marginTop: 14 }}>
          Every widget below is a standalone iframe. Copy one line, paste it
          anywhere on wavewarz.info, wavewarz.com or the intelligence app, and it
          renders live and themed to match. No script tag, no build step, no key.
        </p>
        <p style={{ maxWidth: "62ch", color: C.dim, lineHeight: 1.65, marginTop: 10 }}>
          <b style={{ color: C.text }}>{exclusiveCount} of these exist nowhere else.</b>{" "}
          The treasury, the operating floor, the decoded program instructions and
          the on-chain activity series are not on any WaveWarZ page and are not in
          the public API - they come from indexing the Solana program directly.
          The rest read that same public API, so they can never disagree with the
          numbers the host page already shows.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "28px 0 22px" }}>
          <Seg
            options={["All", ...EMBED_CATEGORIES]}
            value={category}
            onChange={setCategory}
          />
          <Seg
            options={["dark", "light"]}
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
          />
          <button onClick={() => setTransparent((t) => !t)} style={chip(transparent)}>
            TRANSPARENT BG
          </button>
          <label style={{ ...chip(false), display: "flex", alignItems: "center", gap: 8 }}>
            ACCENT
            <input
              type="color"
              value={accent || "#95fe7c"}
              onChange={(e) => setAccent(e.target.value)}
              style={{
                width: 26,
                height: 18,
                border: "none",
                background: "none",
                padding: 0,
                cursor: "pointer",
              }}
            />
          </label>
          {accent && (
            <button onClick={() => setAccent("")} style={chip(false)}>
              RESET ACCENT
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
          }}
        >
          {shown.map((w) => {
            const q: string[] = [];
            if (theme === "light") q.push("theme=light");
            if (transparent) q.push("transparent=1");
            if (accent) q.push(`accent=${accent.replace("#", "")}`);
            const src = `/embed/${w.slug}${q.length ? `?${q.join("&")}` : ""}`;

            return (
              <article
                key={w.slug}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.grid}`,
                  borderRadius: 16,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h2 style={{ margin: 0, fontSize: 15 }}>{w.title}</h2>
                  {w.exclusive && (
                    <span
                      style={{
                        ...label,
                        fontSize: 8.5,
                        color: C.bg,
                        background: C.accent,
                        padding: "2px 6px",
                        borderRadius: 999,
                      }}
                    >
                      ON-CHAIN ONLY
                    </span>
                  )}
                </div>
                <p style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.55, margin: "0 0 12px" }}>
                  {w.blurb}
                </p>

                <iframe
                  src={src}
                  title={w.title}
                  height={w.height}
                  loading="lazy"
                  style={{
                    width: "100%",
                    border: `1px solid ${C.grid}`,
                    borderRadius: 12,
                    background: "transparent",
                  }}
                />

                <p style={{ ...label, marginTop: 12, color: C.dim }}>
                  SUGGESTED: {w.suggestedHost.toUpperCase()}
                </p>

                <pre
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.grid}`,
                    borderRadius: 10,
                    padding: 10,
                    margin: "8px 0 10px",
                    fontSize: 10.5,
                    lineHeight: 1.5,
                    color: C.dim,
                    fontFamily: FONTS.mono,
                    overflowX: "auto",
                    whiteSpace: "pre",
                  }}
                >
                  {snippet(w, theme, transparent, accent)}
                </pre>

                <button
                  onClick={() => copy(w)}
                  style={{
                    ...chip(copied === w.slug),
                    width: "100%",
                    padding: "9px 12px",
                    cursor: "pointer",
                  }}
                >
                  {copied === w.slug ? "COPIED" : "COPY IFRAME"}
                </button>
              </article>
            );
          })}
        </div>

        <section style={{ marginTop: 44, maxWidth: "68ch" }}>
          <p style={label}>NOTES</p>
          <ul style={{ color: C.dim, lineHeight: 1.75, fontSize: 13.5, paddingLeft: 18 }}>
            <li>
              Framing is restricted by CSP to wavewarz.info, wavewarz.com, the
              intelligence app and Vercel previews. Add a host in next.config.mjs.
            </li>
            <li>
              Params: <code>theme=light</code>, <code>transparent=1</code>,{" "}
              <code>bare=1</code> to drop the title row, <code>accent=RRGGBB</code>.
              Anything unrecognised falls back to the default rather than erroring.
            </li>
            <li>
              Every widget carries a source line linking back to the full section.
              That attribution is not configurable.
            </li>
            <li>
              Want one that is not here? The registry is lib/embeds.ts and the
              components are components/embeds/Widgets.tsx - a new widget is one
              entry plus one component.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}

const label: React.CSSProperties = {
  margin: 0,
  fontSize: 10,
  letterSpacing: ".24em",
  textTransform: "uppercase",
  color: C.dim,
  fontFamily: FONTS.mono,
};

function chip(active: boolean): React.CSSProperties {
  return {
    background: active ? C.accent : "transparent",
    color: active ? C.bg : C.dim,
    border: `1px solid ${active ? C.accent : C.grid}`,
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 10,
    letterSpacing: ".16em",
    textTransform: "uppercase",
    fontFamily: FONTS.mono,
    cursor: "pointer",
  };
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={chip(value === o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
