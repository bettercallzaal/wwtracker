// Shared visual language.
//
// These are the WaveWarZ design system tokens, taken verbatim from
// docs/DESIGN-SYSTEM.md v1.0 in the CandyToyBox/wavewarz-intelligence repo.
//
// wwtracker used to have its own identity - a plum ground with a gold accent -
// which made sense while it was a standalone analytics site. It is not that any
// more: its charts are meant to be embedded on wavewarz.info, and a widget that
// arrives in a different palette than the page around it reads as a third-party
// bolt-on no matter how good the data is. Site and embeds now share one system,
// so a partner page and wwtracker feel like the same product.
//
// Hard rule inherited from that document: zero purple, in any shade. `danger`
// is red and is reserved for sell actions, losses and the operating-floor line -
// never for anything required or positive.

export const C = {
  /** Deepest ground - empty states, chart backdrops. */
  void: "#080d17",
  bg: "#0d1321",
  /** Primary card surface - panels, stat cards. */
  panel: "#0f1626",
  /** Chip backgrounds and small inset surfaces, one step up from panel. */
  elev: "#111a2c",
  /** THE accent. Primary series, CTAs, success, live indicators. */
  accent: "#95fe7c",
  /** Green at chip-background strength. Subtle fills and borders only. */
  accentDim: "rgba(149,254,124,.14)",
  /** Secondary / informational - links, second data series. */
  blue: "#7ec1fb",
  blueDim: "rgba(126,193,251,.12)",
  /** Primary body text on dark surfaces. */
  text: "#daecfd",
  /** Secondary text, captions, timestamps. */
  dim: "#8b97ab",
  /** All hairline borders and chart grid lines. */
  grid: "rgba(126,193,251,.14)",
  good: "#95fe7c",
  danger: "#ef4444",
  mono: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  /** The arena voice: condensed, always uppercase, for scoreboard-feeling text. */
  disp: "var(--font-disp), 'Rajdhani', system-ui, sans-serif",
} as const;

/**
 * The accent as bare `r,g,b` so a component can build its own rgba() gradient
 * stops. Several charts need a fading fill, and hardcoding the channel numbers
 * is how the old gold survived in a dozen files after the palette had moved on.
 */
export const ACCENT_RGB = "149,254,124";

export const metaLabel: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: "0.24em",
  textTransform: "uppercase",
  color: C.dim,
  fontFamily: C.mono,
};
