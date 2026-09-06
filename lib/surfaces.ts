// The three WaveWarZ surfaces, what each is for, and who owns which part of
// the WBS-1 build.
//
// Written down because three people own equal thirds of the platform and the
// work divides cleanly along what each already controls. An undocumented split
// is how co-founders end up disagreeing about who built what.
//
// Status values are measured, not aspirational. Anything marked "blocked" names
// what is blocking it.

export type Stage = "live" | "partial" | "blocked" | "not started";

export interface BuildItem {
  step: string;
  stage: Stage;
  note?: string;
}

export interface Surface {
  slug: string;
  host: string;
  name: string;
  owner: string;
  role: string;
  /** One line a stranger could read and understand what this is for. */
  summary: string;
  holds: string[];
  ownsInStandard: string;
  build: BuildItem[];
}

export const SURFACES: Surface[] = [
  {
    slug: "wavewarz-com",
    host: "wavewarz.com",
    name: "The Arena",
    owner: "Hurricane",
    role: "Founder, contracts",
    summary:
      "Where battles actually happen. The flagship arena and the Solana program underneath it.",
    holds: [
      "The Solana program 9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo",
      "The program source and IDL, currently private",
      "The upgrade authority",
      "The live battle experience",
    ],
    ownsInStandard:
      "The battle engine. Anything that requires touching the contract belongs here.",
    build: [
      { step: "Publish the IDL to the other two surfaces", stage: "blocked", note: "Private. Gates six later steps in the PRD sequence." },
      { step: "Move the upgrade authority to a multisig", stage: "not started", note: "Today a single bare wallet can replace the settlement logic." },
      { step: "Fix battle_id so two arenas cannot collide", stage: "not started", note: "The id is the Unix start second and the only PDA seed." },
      { step: "Bidirectional USDC adapter", stage: "not started" },
      { step: "Community token adapter", stage: "not started" },
    ],
  },
  {
    slug: "wavewarz-info",
    host: "wavewarz.info",
    name: "The Record",
    owner: "Candy",
    role: "Co-founder, product and design",
    summary:
      "The system of record. Indexes the chain, holds the canonical Battle ID, and serves the public API everything else reads.",
    holds: [
      "Helius to Supabase indexing",
      "The admin panel where Main Event judging is entered",
      "The canonical Battle ID",
      "The public API at /api/public/*",
    ],
    ownsInStandard:
      "The record. Indexing, backfill, identity, and the API partners read from.",
    build: [
      { step: "Index battles from chain", stage: "live", note: "Already does what the PRD asks to be built." },
      { step: "Backfill historical battles", stage: "partial", note: "1,501 battles are in the public API today." },
      { step: "Canonical Artist IDs", stage: "not started", note: "Handle resolution exists in the lab; no canonical ID yet." },
      { step: "Operator attribution on the battle record", stage: "not started", note: "Nothing on chain or in the API carries it." },
      { step: "Register the first external operator", stage: "blocked", note: "Needs the operator model above." },
    ],
  },
  {
    slug: "wwtracker",
    host: "wwtracker.vercel.app",
    name: "The Lab",
    owner: "Zaal",
    role: "Co-founder, ecosystem and analytics",
    summary:
      "Where things get proven before they ship. The business layer, the embeds, and the standard itself.",
    holds: [
      "Treasury, fee model and the on-chain business layer",
      "17 embed widgets, framed on other sites",
      "The newsletter and the composer",
      "The protocol repo and the WBS-1 spec",
    ],
    ownsInStandard:
      "The standard itself, the integration surface, and everything partner-facing.",
    build: [
      { step: "Verify the Battle account from chain", stage: "live", note: "12 fields confirmed across 40 battles, reproducible." },
      { step: "Freeze WBS-1 semantics", stage: "partial", note: "Template written; 15 open decisions across five spec files." },
      { step: "An interactive battle widget", stage: "blocked", note: "All 17 embeds are read-only. This is the Ather demo." },
      { step: "Connect SDK around the IDL", stage: "blocked", note: "Waiting on the IDL." },
      { step: "Partner and network pool accounting", stage: "not started" },
    ],
  },
];

export function findSurface(slug: string): Surface | undefined {
  return SURFACES.find((s) => s.slug === slug);
}

/** Counts by stage across every surface - the honest headline number. */
export function buildTally(): Record<Stage, number> {
  const t: Record<Stage, number> = { live: 0, partial: 0, blocked: 0, "not started": 0 };
  for (const s of SURFACES) for (const b of s.build) t[b.stage] += 1;
  return t;
}
