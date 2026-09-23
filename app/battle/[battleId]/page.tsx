import { notFound } from "next/navigation";
import BattleView, { type SideInfo } from "@/components/BattleView";
import { cachedFetch } from "@/lib/wwCache";
import { shapeBattle, type RawBattle } from "@/lib/liveBattle";
import { widgetEnabled } from "@/lib/ww/widgetFlag";
import { marksEnabled } from "@/lib/ww/marksFlag";

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

async function sidesFor(battleId: string): Promise<{ sides: { a: SideInfo; b: SideInfo } | null; streamLink: string | null; url: string | null }> {
  try {
    const payload = await cachedFetch<RawBattle & { streamLink?: string }>(
      `battle-${battleId}`,
      `https://wavewarz.info/api/public/battles/${battleId}`,
      { revalidateSeconds: 20 },
    );
    const raw = payload.data as (RawBattle & { streamLink?: string }) | null | undefined;
    const shaped = raw ? shapeBattle(raw) : null;
    if (!shaped) return { sides: null, streamLink: null, url: null };
    return {
      sides: {
        a: { artist: shaped.a.artist, track: shaped.a.track, art: shaped.a.art },
        b: { artist: shaped.b.artist, track: shaped.b.track, art: shaped.b.art },
      },
      streamLink: typeof raw?.streamLink === "string" && raw.streamLink ? raw.streamLink : null,
      url: shaped.url,
    };
  } catch {
    return { sides: null, streamLink: null, url: null };
  }
}

export default async function BattlePage({ params }: { params: Promise<{ battleId: string }> }) {
  const { battleId } = await params;
  if (!/^\d{9,12}$/.test(battleId)) notFound();
  const { sides, streamLink, url } = await sidesFor(battleId);
  return (
    <BattleView
      battleId={Number(battleId)}
      sides={sides}
      streamLink={streamLink}
      siteUrl={url}
      tradingEnabled={widgetEnabled()}
      marksEnabled={marksEnabled()}
    />
  );
}
