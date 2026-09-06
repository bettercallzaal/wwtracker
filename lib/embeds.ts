// The embeddable widget registry.
//
// Each entry is one chart or one number that WaveWarZ can drop anywhere as a
// standalone iframe: https://wwtracker.vercel.app/embed/<slug>
//
// WHY THIS SPLIT MATTERS. wavewarz.info already renders battles, leaderboards,
// songs, charity totals and per-artist pages. Rebuilding those here would be
// duplicate work with a second set of numbers to keep in sync - the exact
// failure this repo just got audited for. So the registry is deliberately
// weighted toward `onchain` widgets: the treasury wallet, the program's own
// instruction mix, daily on-chain activity, the operating floor. A survey of
// every wavewarz.info page on 2026-09-05 found none of that anywhere on the
// site, and none of it is reachable through their public API. That is the gap
// wwtracker fills, and it is the reason to embed us rather than re-query.
//
// The `platform` widgets are here only because a host page often wants one
// headline number next to an on-chain chart, and making them re-implement a
// counter is rude. They read the same public API the host site reads, so they
// can never disagree with it.

export type EmbedSource =
  /** Dune, over the Solana program or the treasury wallet. Nobody else has this. */
  | "onchain"
  /** wavewarz.info public API - the same numbers the host site already shows. */
  | "platform"
  /** A snapshot file in public/, rebuilt from one of the two above. */
  | "snapshot";

export type EmbedForm = "counter" | "line" | "area" | "bar" | "pie" | "table";

export type EmbedCategory =
  | "Treasury"
  | "Volume"
  | "Activity"
  | "Leaderboards"
  | "Platform";

export interface EmbedWidget {
  slug: string;
  title: string;
  /** One line, written for whoever is choosing a widget from the gallery. */
  blurb: string;
  category: EmbedCategory;
  source: EmbedSource;
  form: EmbedForm;
  /** Height that makes the widget look intentional rather than cropped. */
  height: number;
  /** Where this naturally belongs on the host site, for the gallery's guidance. */
  suggestedHost: string;
  /** True when no other WaveWarZ surface can render this. Sorted first. */
  exclusive: boolean;
}

export const EMBEDS: EmbedWidget[] = [
  // --- The one widget built for an arena rather than an analytics page. It is
  // the only entry that changes while you look at it, and the only one whose
  // normal state is "nothing is happening right now".
  {
    slug: "live-battle",
    title: "Live battle",
    blurb:
      "The battle running right now, with a countdown and the pool split as it moves. Falls back to the last result when nothing is live, which is most of the day.",
    category: "Platform",
    source: "platform",
    form: "counter",
    height: 300,
    suggestedHost: "The top of an arena page, or anywhere a visitor should be pulled into a battle",
    exclusive: false,
  },

  // --- Treasury: entirely ours, sourced from the dev wallet's on-chain history.
  {
    slug: "treasury-floor",
    title: "Treasury vs operating floor",
    blurb:
      "Daily closing SOL balance of the platform treasury against the 3.5 SOL operating floor, with the intraday high that gets skimmed before close.",
    category: "Treasury",
    source: "onchain",
    form: "area",
    height: 340,
    suggestedHost: "Overview, or a transparency / operations page",
    exclusive: true,
  },
  {
    slug: "treasury-balance",
    title: "Treasury balance now",
    blurb:
      "Current SOL held by the platform treasury wallet, with the change since yesterday's close.",
    category: "Treasury",
    source: "onchain",
    form: "counter",
    height: 150,
    suggestedHost: "Overview header strip",
    exclusive: true,
  },

  // --- Volume: rebuilt from per-battle volumes, so it agrees with the platform
  // headline to within 0.2 SOL while adding the shape the headline can't show.
  {
    slug: "volume-cumulative",
    title: "Cumulative volume since launch",
    blurb:
      "True-scale running total of SOL traded, from the platform's first battle on 2025-05-28 to today.",
    category: "Volume",
    source: "snapshot",
    form: "area",
    height: 340,
    suggestedHost: "Overview, under the total-volume counter",
    exclusive: true,
  },
  {
    slug: "volume-daily",
    title: "Daily trading volume",
    blurb: "SOL traded per day, both sides, showing the spikes main events create.",
    category: "Volume",
    source: "snapshot",
    form: "bar",
    height: 300,
    suggestedHost: "Battles",
    exclusive: true,
  },
  {
    slug: "battles-daily",
    title: "Battles per day",
    blurb: "How many battles were created each day - the platform's activity heartbeat.",
    category: "Volume",
    source: "snapshot",
    form: "bar",
    height: 300,
    suggestedHost: "Battles",
    exclusive: true,
  },

  // --- Activity: decoded straight off the program. No other surface decodes
  // Anchor discriminators, so this is the clearest "it is really on-chain" proof.
  {
    slug: "program-activity",
    title: "On-chain program activity",
    blurb:
      "Daily transactions and unique signers hitting the WaveWarZ Solana program.",
    category: "Activity",
    source: "onchain",
    form: "line",
    height: 320,
    suggestedHost: "Overview, or an API / developer page",
    exclusive: true,
  },
  {
    slug: "instruction-mix",
    title: "Instruction mix",
    blurb:
      "Every call to the program, decoded by Anchor discriminator: buys, sells, claims, battles created and settled.",
    category: "Activity",
    source: "onchain",
    form: "bar",
    height: 320,
    suggestedHost: "API docs page - it shows the program is genuinely busy",
    exclusive: true,
  },

  // --- Platform: convenience mirrors of the host site's own numbers.
  {
    slug: "total-volume",
    title: "Total volume",
    blurb: "All-time SOL traded across every battle, in SOL and USD.",
    category: "Platform",
    source: "platform",
    form: "counter",
    height: 150,
    suggestedHost: "Anywhere a headline number is wanted",
    exclusive: false,
  },
  {
    slug: "total-battles",
    title: "Total battles",
    blurb: "Every battle ever run, split into main events, quick and community.",
    category: "Platform",
    source: "platform",
    form: "counter",
    height: 150,
    suggestedHost: "Overview",
    exclusive: false,
  },
  {
    slug: "artist-payouts",
    title: "Paid to artists",
    blurb:
      "Total SOL paid straight to artists - 1 percent of trading volume plus settlement bonuses, automatic and on-chain.",
    category: "Platform",
    source: "platform",
    form: "counter",
    height: 150,
    suggestedHost: "Overview, Benefits, or any artist-facing pitch",
    exclusive: false,
  },
  {
    slug: "trader-claims",
    title: "Claimed by traders",
    blurb: "Total SOL withdrawn by traders, and how many withdrawals that took.",
    category: "Platform",
    source: "platform",
    form: "counter",
    height: 150,
    suggestedHost: "Claim page",
    exclusive: false,
  },
  {
    slug: "battle-type-mix",
    title: "Battle type mix",
    blurb: "Share of all battles that are quick, main event, or community.",
    category: "Platform",
    source: "platform",
    form: "pie",
    height: 300,
    suggestedHost: "Battles",
    exclusive: false,
  },

  // --- Leaderboards: read live off the public API so they can never drift from
  // the host site's own boards.
  {
    slug: "top-artists",
    title: "Top artists",
    blurb: "Main event artists ranked by volume, with record and earnings.",
    category: "Leaderboards",
    source: "platform",
    form: "table",
    height: 420,
    suggestedHost: "Leaderboards - Artists",
    exclusive: false,
  },
  {
    slug: "top-traders",
    title: "Top traders",
    blurb: "Traders ranked by SOL volume, with win rate and net profit and loss.",
    category: "Leaderboards",
    source: "platform",
    form: "table",
    height: 420,
    suggestedHost: "Leaderboards - Traders",
    exclusive: false,
  },
  {
    slug: "top-songs",
    title: "Top songs",
    blurb: "Quick battle songs ranked by SOL volume, with record and win rate.",
    category: "Leaderboards",
    source: "platform",
    form: "table",
    height: 420,
    suggestedHost: "Leaderboards - Songs",
    exclusive: false,
  },
];

export function findEmbed(slug: string): EmbedWidget | undefined {
  return EMBEDS.find((e) => e.slug === slug);
}

/** Exclusive widgets first, then by category, so the gallery leads with what only we have. */
export function sortedEmbeds(): EmbedWidget[] {
  const order: EmbedCategory[] = [
    "Treasury",
    "Volume",
    "Activity",
    "Platform",
    "Leaderboards",
  ];
  return [...EMBEDS].sort((a, b) => {
    if (a.exclusive !== b.exclusive) return a.exclusive ? -1 : 1;
    return order.indexOf(a.category) - order.indexOf(b.category);
  });
}

export const EMBED_CATEGORIES: EmbedCategory[] = [
  "Treasury",
  "Volume",
  "Activity",
  "Platform",
  "Leaderboards",
];
