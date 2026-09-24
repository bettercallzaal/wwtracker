import { notFound } from "next/navigation";
import BattleView, { type SideInfo } from "@/components/BattleView";
import { cachedFetch } from "@/lib/wwCache";
import { shapeBattle, type RawBattle } from "@/lib/liveBattle";
import { widgetEnabled } from "@/lib/ww/widgetFlag";
import { marksEnabled } from "@/lib/ww/marksFlag";
import registry from "@/data/community-battles.json";
import {
  describeNameSource,
  lookupCommunityBattle,
  parseCommunityRegistry,
  type NameSource,
} from "@/lib/ww/communityBattles";

/**
 * /battle/<id>: one battle on one screen. Clock, pools and chart from the
 * chain and the watcher; names, tracks and stream from the public API; the
 * trade widget when WW_WIDGET is set; the claim panel once settled.
 *
 * READABLE WITHOUT THE FLAG. The page itself moves no money, so it is not
 * gated like /widget; only the trading panel inside it is, and the page says
 * so rather than hiding the gap.
 *
 * The public API is fetched here, on the server, through the same cache the
 * embeds use (20 s), so a hundred viewers cost one upstream call per window.
 * If it fails the page still renders from chain with "Artist A" and "Artist B".
 */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { robots: { index: false, follow: false } };
}

async function sidesFor(battleId: string): Promise<{
  sides: { a: SideInfo; b: SideInfo } | null;
  streamLink: string | null;
  url: string | null;
  nameSource: NameSource;
  upstreamReachable: boolean;
  communityTitle: string | null;
  communityHost: string | null;
}> {
  const { battles } = parseCommunityRegistry(registry);
  const community = lookupCommunityBattle(battles, battleId);
  const fromCommunity = () => ({
    sides: community
      ? {
          a: { artist: community.a.artist, track: community.a.track ?? "", art: "" },
          b: { artist: community.b.artist, track: community.b.track ?? "", art: "" },
        }
      : null,
    streamLink: null,
    url: null,
    nameSource: (community ? "community" : "none") as NameSource,
    communityTitle: community?.title ?? null,
    communityHost: community?.host ?? null,
  });

  let upstreamReachable = true;
  try {
    const payload = await cachedFetch<RawBattle & { streamLink?: string }>(
      `battle-${battleId}`,
      `https://wavewarz.info/api/public/battles/${battleId}`,
      { revalidateSeconds: 20 },
    );
    const raw = payload.data as (RawBattle & { streamLink?: string }) | null | undefined;
    const shaped = raw ? shapeBattle(raw) : null;
    // UPSTREAM WINS WHEN IT HAS THE BATTLE. Their battles are their record, and
    // a local file quietly disagreeing with the platform about who competed is
    // worse than having no local file. The registry fills a hole.
    if (shaped) {
      return {
        sides: {
          a: { artist: shaped.a.artist, track: shaped.a.track, art: shaped.a.art },
          b: { artist: shaped.b.artist, track: shaped.b.track, art: shaped.b.art },
        },
        streamLink: typeof raw?.streamLink === "string" && raw.streamLink ? raw.streamLink : null,
        url: shaped.url,
        nameSource: "upstream",
        upstreamReachable,
        communityTitle: null,
        communityHost: null,
      };
    }
    // Answered, and does not have this battle. For a battle we launched that
    // is permanent and correct, not an outage.
  } catch {
    // Did not answer. A DIFFERENT FACT from "does not have it", and the page
    // says which: for our own battles only one of the two will ever be true.
    upstreamReachable = false;
  }
  return { ...fromCommunity(), upstreamReachable };
}

export default async function BattlePage({ params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params;
  if (!/^\d{9,12}$/.test(battleId)) notFound();
  const { sides, streamLink, url, nameSource, upstreamReachable, communityTitle, communityHost } =
    await sidesFor(battleId);
  return (
    <BattleView
      battleId={Number(battleId)}
      sides={sides}
      streamLink={streamLink}
      siteUrl={url}
      tradingEnabled={widgetEnabled()}
      marksEnabled={marksEnabled()}
      nameNote={describeNameSource(nameSource, upstreamReachable)}
      communityTitle={communityTitle}
      communityHost={communityHost}
    />
  );
}
