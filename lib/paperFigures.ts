/**
 * The figures the dynamic whitepaper renders, and the rules that keep them
 * honest. Zaal, 2026-09-19: "Let's make a dynamic whitepaper that updates and
 * has a source url."
 *
 * IN `lib/` AND NOT `lib/ww/`. The SDK surface is what somebody else lifts into
 * their own stack to trade against the program; a list of figures for OUR
 * whitepaper is not that. `wwSdkBoundary.test.ts` enforces it from both sides -
 * it refused this file for reading `process` and then refused it again for not
 * being on the declared surface. Two refusals, both correct, and the fix was
 * the same each time: the file was in the wrong folder, not the guard.
 *
 * NO SENTENCE MAY HARD-CODE A FIGURE THIS MODULE COMPUTES. That is the whole
 * design and it is enforced by a test, not by care. A paper whose prose says
 * "about 1,600 battles" beside a live count that has moved to 1,750 is worse
 * than one with no live figures at all, because the reader cannot tell which
 * half is current. Comparatives are computed too: "most battles are small" is
 * rendered from the median rather than asserted next to it.
 *
 * A SOURCE THAT IS DOWN SHOWS THE LAST GOOD VALUE WITH ITS DATE, NEVER A BLANK
 * AND NEVER A ZERO. A zero in an artist-payouts field reads as "artists have
 * been paid nothing", which is a lie the page would be telling on its own
 * initiative. `lib/wwCache.ts` already returns `status: "unknown"` with `data:
 * null` rather than a zero-filled placeholder, and this carries that distinction
 * all the way to the rendered figure.
 *
 * "AS OF" IS WHEN THE NUMBER WAS READ, not when the page was built and not
 * today's date. A page rebuilt hourly that stamps every figure with the build
 * time would claim freshness it does not have the moment one source goes stale.
 *
 * SOME FIGURES ARE DELIBERATELY FROZEN. The launch-fee observation is a sample
 * twenty creations wide taken on 2026-09-06, not a continuous measurement.
 * Re-reading it live would imply a monitor nobody is running. Those carry
 * `kind: "dated-observation"` and render with their own date, never with an
 * as-of stamp that suggests they update.
 */

/** Where a figure came from, as something a reader can click. */
export interface FigureSource {
  label: string;
  url: string;
}

export type FigureStatus = "live" | "stale" | "unknown";

export interface Figure {
  id: string;
  label: string;
  /** Null when the source is unreachable and nothing good was ever stored. */
  value: number | null;
  unit: "SOL" | "USD" | "count" | "percent" | "date";
  status: FigureStatus;
  /** ISO time the VALUE was read. Null when nothing has been read. */
  asOf: string | null;
  source: FigureSource;
  /** Set when status is "stale": how old the last good read is. */
  ageSeconds?: number | null;
  /** A frozen sample rather than a live reading. */
  kind?: "dated-observation";
  /** For a dated observation, the date it was taken. */
  observedOn?: string;
}

const UPSTREAM: FigureSource = {
  label: "wavewarz.info public API",
  url: "https://wavewarz.info/api/public/stats",
};
const CHAIN: FigureSource = {
  label: "the WaveWarZ program on Solana",
  url: "https://solscan.io/account/9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo",
};

/** What the page needs from `/api/public/stats`, and nothing more. */
export interface StatsShape {
  updatedAt?: string;
  solPriceUsd?: number;
  volume?: { totalSol?: number };
  artistPayouts?: { totalSol?: number };
  battles?: { total?: number; mainEvents?: number };
}

/** The cache envelope `lib/wwCache.ts` produces. Retyped so this stays pure. */
export interface Cached<T> {
  status: FigureStatus;
  fetchedAt: string | null;
  ageSeconds: number | null;
  data: T | null;
}

/** Facts read from chain by a scan, with the time of that scan. */
export interface ChainShape {
  battleAccounts: number;
  settled: number;
  readAt: string;
}

const fig = (
  id: string,
  label: string,
  value: number | null,
  unit: Figure["unit"],
  c: { status: FigureStatus; fetchedAt: string | null; ageSeconds: number | null },
  source: FigureSource,
): Figure => ({
  id,
  label,
  // A present envelope with an absent number is still unknown. Guarding on the
  // envelope alone would let `undefined` through as a rendered blank.
  value: value === undefined || value === null || !Number.isFinite(value) ? null : value,
  unit,
  status: value === undefined || value === null || !Number.isFinite(value) ? "unknown" : c.status,
  asOf: c.fetchedAt,
  ageSeconds: c.status === "stale" ? c.ageSeconds : undefined,
  source,
});

export function buildFigures(p: {
  stats: Cached<StatsShape>;
  chain: Cached<ChainShape>;
}): Figure[] {
  const s = p.stats.data;
  const c = p.chain.data;
  const price = s?.solPriceUsd;
  const payouts = s?.artistPayouts?.totalSol;
  const volume = s?.volume?.totalSol;

  return [
    fig("battles_api", "Battles the platform reports", s?.battles?.total ?? null, "count", p.stats, UPSTREAM),
    fig("battles_chain", "Battle accounts the program owns", c?.battleAccounts ?? null, "count", p.chain, CHAIN),
    fig("settled_chain", "Settled on chain", c?.settled ?? null, "count", p.chain, CHAIN),
    fig("volume_sol", "Total staked, all time", volume ?? null, "SOL", p.stats, UPSTREAM),
    fig(
      "volume_usd",
      "Total staked, in dollars",
      volume != null && price != null ? volume * price : null,
      "USD",
      p.stats,
      UPSTREAM,
    ),
    fig("payouts_sol", "Paid out to artists", payouts ?? null, "SOL", p.stats, UPSTREAM),
    fig(
      "payouts_usd",
      "Paid out to artists, in dollars",
      payouts != null && price != null ? payouts * price : null,
      "USD",
      p.stats,
      UPSTREAM,
    ),
    fig("sol_price", "SOL price used for the dollar figures", price ?? null, "USD", p.stats, UPSTREAM),
    {
      id: "launch_fee_observation",
      label: "Battle creations checked for a launch fee, none charged",
      value: 20,
      unit: "count",
      status: "live",
      asOf: null,
      source: CHAIN,
      kind: "dated-observation",
      observedOn: "2026-09-06",
    },
  ];
}

/**
 * The one-line rendering of a figure, including the unreachable case.
 *
 * It never returns "0" for an absent value and it never returns an empty
 * string: a reader must be able to tell "nobody could read this" from "this is
 * genuinely zero", and an empty cell says neither.
 */
export function renderFigure(f: Figure): string {
  if (f.value === null) return "unavailable";
  const n = f.value;
  switch (f.unit) {
    case "SOL":
      return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL`;
    case "USD":
      return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    case "percent":
      return `${n.toFixed(1)}%`;
    default:
      return n.toLocaleString();
  }
}

/**
 * The sentence under a figure saying how much to trust it.
 *
 * A stale figure says so in words rather than in a colour, because a colour is
 * invisible to anyone reading the text and to anyone quoting it.
 */
export function freshnessNote(f: Figure): string {
  if (f.kind === "dated-observation") {
    return `a one-off check on ${f.observedOn}, not a live reading`;
  }
  if (f.value === null) return "the source could not be read, and no earlier value was stored";
  if (f.status === "stale") {
    const mins = f.ageSeconds != null ? Math.round(f.ageSeconds / 60) : null;
    return mins != null
      ? `the source is not responding; this is the last good read, ${mins} minutes old`
      : "the source is not responding; this is the last good read";
  }
  return f.asOf ? `read ${f.asOf}` : "read just now";
}

/** Every figure a page can render, for the test that forbids hard-coded numbers. */
export const figureIds = (fs: Figure[]): string[] => fs.map((f) => f.id);
