import { notFound } from "next/navigation";
import ClaimPanel from "@/components/ClaimPanel";
import { widgetEnabled } from "@/lib/ww/widgetFlag";

/**
 * The claim panel. Behind the same gate as the trade widget and for the same
 * reason: this is a page that can move money, and every other page in this app
 * is read-only.
 *
 * `notFound()` runs on the server, so with `WW_WIDGET` unset the route does not
 * exist to a visitor - no markup, no bundle, no unlisted page for somebody to
 * find. Deliberately NOT a `NEXT_PUBLIC_` variable, which would ship the value
 * to every visitor and make the gate a decoration.
 *
 * ONE GATE FOR BOTH SURFACES IS THE POINT. A second flag would eventually be set
 * to a different value than the first, and "the trade widget is off" would stop
 * implying "nothing here can spend". `widgetEnabled` is the one decision.
 *
 * NO BATTLE ID IN THE PATH, unlike the widget. A claim is a question about a
 * WALLET - which settled battles still owe it - and the wallet is not known
 * until someone connects. Putting an id here would invite a link that implies an
 * answer before the read that produces it.
 */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  // Not indexable even where it is enabled.
  return { robots: { index: false, follow: false } };
}

export default async function ClaimPage() {
  if (!widgetEnabled()) notFound();
  return <ClaimPanel />;
}
