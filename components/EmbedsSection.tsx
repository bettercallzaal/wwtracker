"use client";

import { useState } from "react";
import { EMBEDS, EMBED_CATEGORIES, findEmbed, sortedEmbeds, type EmbedWidget } from "@/lib/embeds";
import { C, metaLabel } from "@/lib/theme";

// Fixed host for the copy-paste snippet, matching the constant already used in
// components/embeds/Widgets.tsx and app/sitemap.ts. The live previews below
// use relative /embed/<slug> paths instead, so this section renders correctly
// on localhost and Vercel previews too - only the snippet needs a real host,
// because it is meant to be pasted onto someone else's page.
const SITE = "https://wwtracker.vercel.app";

// treasury-floor and volume-cumulative are the strongest exclusives. For the
// third, instruction-mix beats another area chart on variety (it's a bar
// chart) and is the one lib/embeds.ts itself calls "the clearest 'it is
// really on-chain' proof" - decoded Anchor discriminators, not a number
// anyone could fake from the outside.
const PREVIEW_SLUGS = ["treasury-floor", "volume-cumulative", "instruction-mix"];
const SNIPPET_SLUG = "treasury-floor";

function oneLineSnippet(w: EmbedWidget): string {
  return `<iframe src="${SITE}/embed/${w.slug}" title="${w.title} - WaveWarZ on-chain" width="100%" height="${w.height}" loading="lazy" style="border:0;border-radius:16px"></iframe>`;
}

export default function EmbedsSection() {
  const [copied, setCopied] = useState(false);

  // Computed from the registry, not hardcoded, so the count stays true the
  // day someone adds or retires a widget in lib/embeds.ts.
  const exclusiveCount = EMBEDS.filter((w) => w.exclusive).length;

  const previews = PREVIEW_SLUGS.map((slug) => findEmbed(slug)).filter(
    (w): w is EmbedWidget => Boolean(w)
  );
  const snippetWidget = findEmbed(SNIPPET_SLUG) ?? EMBEDS[0];
  const remaining = sortedEmbeds().filter((w) => !PREVIEW_SLUGS.includes(w.slug));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(oneLineSnippet(snippetWidget));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is permission-gated in some embeds; the snippet is printed
      // right above the button, so a failed copy costs nothing but a manual
      // select.
      setCopied(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / embeds</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Every chart on this page is also a standalone iframe. Drop one line
          onto any page - wavewarz.info, wavewarz.com, the intelligence app,
          anywhere - and it renders live, themed to match WaveWarZ, with no key
          and no build step.
        </p>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          <b>{exclusiveCount} of these exist nowhere else.</b> The treasury,
          the operating floor, the decoded program instructions and the
          on-chain activity series are not on any WaveWarZ page and are not in
          their public API - they come from indexing the Solana program
          directly.
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        {previews.map((w) => (
          <div
            key={w.slug}
            style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 14 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>{w.title}</h2>
              {w.exclusive && (
                <span
                  style={{
                    ...metaLabel,
                    fontSize: 8.5,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
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
            <p style={{ margin: "0 0 10px", color: C.dim, fontSize: 12.5, lineHeight: 1.55 }}>{w.blurb}</p>
            {/* Relative path: the same markup works on localhost, a preview
                deploy and production without touching a single URL. */}
            <iframe
              src={`/embed/${w.slug}`}
              title={w.title}
              height={w.height}
              loading="lazy"
              style={{ width: "100%", border: `1px solid ${C.grid}`, borderRadius: 12, background: "transparent" }}
            />
          </div>
        ))}
      </section>

      <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}>
        <p style={{ ...metaLabel, marginBottom: 8 }}>THE WHOLE INTEGRATION</p>
        <pre
          style={{
            background: C.bg,
            border: `1px solid ${C.grid}`,
            borderRadius: 10,
            padding: 12,
            margin: "0 0 10px",
            fontSize: 11.5,
            lineHeight: 1.6,
            color: C.dim,
            fontFamily: C.mono,
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {oneLineSnippet(snippetWidget)}
        </pre>
        <button
          onClick={copy}
          style={{
            background: copied ? C.accent : "transparent",
            color: copied ? C.bg : C.dim,
            border: `1px solid ${copied ? C.accent : C.grid}`,
            borderRadius: 999,
            padding: "8px 14px",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontFamily: C.mono,
            cursor: "pointer",
          }}
        >
          {copied ? "COPIED" : "COPY THIS LINE"}
        </button>
      </section>

      <section>
        <p style={{ ...metaLabel, marginBottom: 10 }}>{remaining.length} MORE IN THE GALLERY</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {EMBED_CATEGORIES.map((cat) => {
            const inCat = remaining.filter((w) => w.category === cat);
            if (inCat.length === 0) return null;
            return (
              <p key={cat} style={{ margin: 0, color: C.text, fontSize: 13.5, lineHeight: 1.7 }}>
                <span style={{ ...metaLabel, color: C.dim }}>{cat.toUpperCase()}</span>{" "}
                {inCat.map((w) => w.title).join(", ")}
              </p>
            );
          })}
        </div>
      </section>

      <a
        href="/embed"
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: C.accent,
          color: C.bg,
          textDecoration: "none",
          borderRadius: 999,
          padding: "12px 20px",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: C.mono,
          letterSpacing: "0.04em",
        }}
      >
        Open the full embed gallery, with theming controls
      </a>
    </div>
  );
}
