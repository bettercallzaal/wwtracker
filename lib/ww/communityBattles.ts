/**
 * NAMES FOR BATTLES WE LAUNCH OURSELVES.
 *
 * The chain stores two artist WALLETS and nothing else: no names, no track
 * titles, no art. Everything a viewer reads on `/battle/<id>` comes from
 * `wavewarz.info/api/public/battles/<id>` - and that API will never have heard
 * of a battle we created, because it is their index of their battles.
 *
 * So the first community battle we launch renders as "A" versus "B" forever.
 * This is the registry that fixes it: a file in the repo, reviewed like any
 * other change, because the names of two artists on a public page are not
 * something a form should be able to write unattended.
 *
 * TWO ABSENCES THAT ARE NOT THE SAME, and the page has been collapsing them.
 * `sidesFor` wraps its fetch in a `catch` that returns null, so "the upstream
 * API is down" and "the upstream API has never heard of this battle" produce
 * an identical screen - and for a battle of ours the second is permanent and
 * correct while the first is an outage. A reader deserves to know which.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not let the registry override a
 * battle the upstream API knows about. If both have names, theirs win: their
 * battles are their record, and a local file quietly disagreeing with the
 * platform about who competed is worse than having no local file. The registry
 * fills a hole; it does not paper over one.
 */

export interface CommunitySide {
  artist: string;
  track?: string;
}

export interface CommunityBattle {
  /** What to call the battle. Optional; the artists are the name if it has none. */
  title?: string;
  /** Who ran it. Shown so a community battle is not mistaken for an official one. */
  host?: string;
  a: CommunitySide;
  b: CommunitySide;
}

export interface CommunityRegistry {
  battles: Record<string, CommunityBattle>;
}

/** Where a battle's names came from, so the page can say. */
export type NameSource = "upstream" | "community" | "none";

const BATTLE_ID = /^\d{9,12}$/;

export type RegistryProblem = { battleId: string; reason: string };

/**
 * Read the registry, and report what it refused.
 *
 * Returns problems rather than throwing: one malformed entry must not take the
 * whole file down, and a silently dropped entry is a battle that renders as
 * "A" versus "B" with nobody able to say why.
 */
export function parseCommunityRegistry(input: unknown): {
  battles: Record<string, CommunityBattle>;
  problems: RegistryProblem[];
} {
  const battles: Record<string, CommunityBattle> = {};
  const problems: RegistryProblem[] = [];
  const raw = (input as CommunityRegistry | null)?.battles;
  if (!raw || typeof raw !== "object") {
    return { battles, problems: [{ battleId: "(file)", reason: "no `battles` object" }] };
  }
  for (const [id, entry] of Object.entries(raw)) {
    if (!BATTLE_ID.test(id)) {
      problems.push({ battleId: id, reason: "not a battle id (9 to 12 digits)" });
      continue;
    }
    const e = entry as CommunityBattle | null;
    const a = e?.a?.artist;
    const b = e?.b?.artist;
    // An entry with one side named is worse than no entry: the page would show
    // a real name against a placeholder and read as if one artist had no name.
    if (typeof a !== "string" || a.trim() === "" || typeof b !== "string" || b.trim() === "") {
      problems.push({ battleId: id, reason: "both sides need an artist name" });
      continue;
    }
    if (a.trim() === b.trim()) {
      problems.push({ battleId: id, reason: "both sides name the same artist" });
      continue;
    }
    battles[id] = {
      title: typeof e?.title === "string" && e.title.trim() ? e.title.trim() : undefined,
      host: typeof e?.host === "string" && e.host.trim() ? e.host.trim() : undefined,
      a: { artist: a.trim(), track: typeof e?.a?.track === "string" ? e.a.track.trim() : undefined },
      b: { artist: b.trim(), track: typeof e?.b?.track === "string" ? e.b.track.trim() : undefined },
    };
  }
  return { battles, problems };
}

export function lookupCommunityBattle(
  battles: Record<string, CommunityBattle>,
  battleId: number | string,
): CommunityBattle | null {
  return battles[String(battleId)] ?? null;
}

/**
 * The sentence the page shows about where its names came from.
 *
 * `upstreamReachable` separates the two absences. Without it "no names" reads
 * the same whether the platform is down or simply does not have this battle,
 * and for a battle of ours only one of those will ever be true.
 */
export function describeNameSource(source: NameSource, upstreamReachable: boolean): string {
  if (source === "upstream") return "";
  if (source === "community") {
    return "A community battle. The names come from this repo's own registry, not from wavewarz.info, which does not index battles it did not create.";
  }
  return upstreamReachable
    ? "This battle has no names anywhere: wavewarz.info does not have it and it is not in the community registry. The sides below are the chain's A and B, not artists."
    : "Names could not be loaded - wavewarz.info did not answer. The sides below are the chain's A and B, not artists, and this is an outage rather than a battle without names.";
}
