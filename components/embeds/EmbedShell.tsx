"use client";

import type { ReactNode } from "react";
import { FONTS, type EmbedOptions } from "@/lib/embedTheme";

// The frame every widget renders inside.
//
// Two things it is responsible for that individual widgets should never have to
// think about:
//
// 1. A widget lives on somebody else's page. If our data source is down, the
//    correct behaviour is a quiet one-line note in the host's own colors, not a
//    red error box, not a stack trace, and definitely not a blank iframe that
//    looks like the host's page is broken. Every failure path here is muted.
//
// 2. Attribution. A number with no provenance is a rumour. Each widget carries a
//    small source line naming where the figure came from, linking back to the
//    full section on wwtracker. That link is the entire commercial reason to let
//    someone embed your charts, so it is not optional and not configurable off.

interface Props {
  title: string;
  /** Where the number comes from. Shown small, always. */
  source: string;
  /** Deep link back to the full section on wwtracker. */
  href: string;
  opts: EmbedOptions;
  state?: "ready" | "loading" | "error";
  /** Shown instead of children when state is "error". */
  errorNote?: string;
  children: ReactNode;
}

export default function EmbedShell({
  title,
  source,
  href,
  opts,
  state = "ready",
  errorNote,
  children,
}: Props) {
  const { palette: p, transparent, bare } = opts;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        boxSizing: "border-box",
        padding: "14px 16px 10px",
        background: transparent ? "transparent" : p.bg,
        color: p.ice,
        fontFamily: FONTS.body,
        // The host controls the iframe box; we must never introduce a second
        // scrollbar inside it.
        overflow: "hidden",
      }}
    >
      {!bare && (
        <div
          style={{
            fontFamily: FONTS.disp,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: ".04em",
            fontSize: 15,
            lineHeight: 1.2,
            marginBottom: 10,
            color: p.ice,
          }}
        >
          {title}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {state === "loading" && (
          <div
            style={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              fontFamily: FONTS.mono,
              fontSize: 11,
              letterSpacing: ".24em",
              textTransform: "uppercase",
              color: p.mut,
            }}
          >
            Loading
          </div>
        )}
        {state === "error" && (
          <div
            style={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              padding: "0 12px",
              fontFamily: FONTS.mono,
              fontSize: 11,
              lineHeight: 1.6,
              color: p.mut,
            }}
          >
            {errorNote ?? "Data unavailable right now"}
          </div>
        )}
        {state === "ready" && children}
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginTop: 8,
          fontFamily: FONTS.mono,
          fontSize: 9.5,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: p.mut,
          textDecoration: "none",
          borderTop: `1px solid ${p.line}`,
          paddingTop: 7,
          display: "block",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {source}
      </a>
    </div>
  );
}

/** The big-number layout shared by every counter widget. */
export function Counter({
  value,
  sub,
  opts,
  accentValue = true,
}: {
  value: string;
  sub?: string;
  opts: EmbedOptions;
  accentValue?: boolean;
}) {
  const { palette: p, accent } = opts;
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.disp,
          fontWeight: 700,
          fontSize: "clamp(28px, 9vw, 46px)",
          lineHeight: 1,
          letterSpacing: "-.01em",
          fontVariantNumeric: "tabular-nums",
          color: accentValue ? accent : p.ice,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 7,
            fontFamily: FONTS.mono,
            fontSize: 11,
            letterSpacing: ".08em",
            color: p.mut,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
