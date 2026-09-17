import { notFound } from "next/navigation";
import TradeWidget from "@/components/TradeWidget";
import { widgetEnabled } from "@/lib/ww/widgetFlag";

/**
 * The trading widget, stage 1 of Zaal's 2026-09-13 ruling: prove it in
 * wwtracker, destination wavewarz.info, Candy implements it there.
 *
 * GATED OFF BY DEFAULT, AND THE GATE IS A 404 RATHER THAN A HIDDEN LINK.
 * `notFound()` runs on the server, so with the flag unset this route does not
 * exist to a visitor - no markup, no bundle, no "unlisted page someone finds".
 * Every other page in this app is read-only; this is the first one that can move
 * money, and it should be reachable only where somebody deliberately turned it
 * on.
 *
 * Enable with `WW_WIDGET=1` in the environment. Deliberately NOT a
 * `NEXT_PUBLIC_` variable: those are inlined into client JavaScript, so their
 * value ships to every visitor and the gate would be a decoration rather than a
 * gate.
 */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  // Not indexable even where it is enabled.
  return { robots: { index: false, follow: false } };
}

export default async function WidgetPage({
  params,
}: {
  params: Promise<{ battleId: string }>;
}) {
  if (!widgetEnabled()) notFound();

  const { battleId } = await params;
  // A battle id is a unix-second timestamp, so it is all digits and about ten of
  // them. Rejecting here rather than in the client keeps a malformed id from
  // reaching PDA derivation, which would return a well-formed address for an
  // account that does not exist - the specific failure chain/BATTLE-ACCOUNT.md
  // warns about, where getAccountInfo returns null with no error.
  if (!/^\d{9,12}$/.test(battleId)) notFound();

  return <TradeWidget battleId={Number(battleId)} />;
}
