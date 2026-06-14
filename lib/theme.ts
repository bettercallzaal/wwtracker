// Shared visual language (plum bg, gold accent, mono labels).
export const C = {
  bg: "#190f24",
  panel: "#211531",
  elev: "#2b1c3f",
  accent: "#ffc24b",
  accentDim: "#b8863a",
  text: "#f4ecff",
  dim: "#a596b8",
  grid: "#3a2950",
  good: "#7ee0a0",
  danger: "#ff6b6b",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

export const metaLabel: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: "0.1em",
  color: C.dim,
  fontFamily: C.mono,
};
