// Visual tokens for /embed/* widgets.
//
// These are NOT wwtracker's own colors (lib/theme.ts is plum + gold). An embed
// is rendered inside somebody else's page, so it has to look like it belongs to
// THAT page, not to us. These values are lifted verbatim from the WaveWarZ
// design system published in the wavewarz-intelligence repo
// (docs/DESIGN-SYSTEM.md, v1.0, extracted 2026-07-20) so a widget dropped on
// wavewarz.info reads as native furniture rather than a bolted-on iframe.
//
// Hard rule carried over from that document: zero purple, in any shade. Red is
// reserved for sell actions and Artist A identity - never for "required" or
// anything positive.

export interface EmbedPalette {
  void: string;
  bg: string;
  card: string;
  card2: string;
  line: string;
  green: string;
  greenDim: string;
  blue: string;
  blueDim: string;
  ice: string;
  mut: string;
  red: string;
}

const DARK: EmbedPalette = {
  void: "#080d17",
  bg: "#0d1321",
  card: "#111a2c",
  card2: "#0f1626",
  line: "rgba(126,193,251,.14)",
  green: "#95fe7c",
  greenDim: "rgba(149,254,124,.14)",
  blue: "#7ec1fb",
  blueDim: "rgba(126,193,251,.12)",
  ice: "#daecfd",
  mut: "#8b97ab",
  red: "#ef4444",
};

// Light is a derived mode, not a second design system. The accent greens are
// darkened because #95fe7c on white fails WCAG AA for text; the chart stroke
// keeps the brand green since a 2px line against white is a graphic, not text.
const LIGHT: EmbedPalette = {
  void: "#f2f5fa",
  bg: "#ffffff",
  card: "#f7f9fc",
  card2: "#ffffff",
  line: "rgba(13,19,33,.12)",
  green: "#2f8f14",
  greenDim: "rgba(47,143,20,.10)",
  blue: "#1667ad",
  blueDim: "rgba(22,103,173,.10)",
  ice: "#0d1321",
  mut: "#5a6675",
  red: "#c22c2c",
};

export const FONTS = {
  disp: "'Rajdhani', 'Inter', system-ui, sans-serif",
  body: "'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export interface EmbedOptions {
  palette: EmbedPalette;
  theme: "dark" | "light";
  /** Paint no background at all, so the host page shows through. */
  transparent: boolean;
  /** Hide the title row - for hosts that supply their own heading. */
  bare: boolean;
  /** Override the accent used for the primary data series. */
  accent: string;
}

/** Reject anything that is not a plain hex color, so a param cannot inject CSS. */
function safeHex(v: string | null): string | null {
  if (!v) return null;
  const s = v.startsWith("#") ? v : `#${v}`;
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : null;
}

/**
 * Read widget options off the iframe URL's query string.
 * Everything is optional and every bad value falls back to a default - an embed
 * on someone else's page must never render an error because of a typo'd param.
 */
export function readEmbedOptions(
  params: Record<string, string | string[] | undefined>,
): EmbedOptions {
  const get = (k: string): string | null => {
    const v = params[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };

  const theme = get("theme") === "light" ? "light" : "dark";
  const palette = theme === "light" ? { ...LIGHT } : { ...DARK };
  const accent = safeHex(get("accent")) ?? palette.green;

  return {
    palette,
    theme,
    transparent: get("transparent") === "1",
    bare: get("bare") === "1",
    accent,
  };
}

/** Compact SOL formatting shared by every widget, so units read the same everywhere. */
export function sol(n: number, dp = 2): string {
  return `${n.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })} SOL`;
}

/** Shorten a Solana address for display: first 4 and last 4. */
export function shortWallet(w: string): string {
  return w.length <= 10 ? w : `${w.slice(0, 4)}...${w.slice(-4)}`;
}
