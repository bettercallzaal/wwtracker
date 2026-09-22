import { notFound } from "next/navigation";
import OperatorSettle from "@/components/OperatorSettle";
import { operatorEnabled } from "@/lib/ww/operatorFlag";

/**
 * /operator: settle battles the program has not settled.
 *
 * Gated by WW_OPERATOR, a 404 without it, like /widget under WW_WIDGET. The
 * page lists every battle past its end time with winner_decided still 0 and
 * lets a connected wallet run endBattle on one, simulate first, sign second.
 * Launching battles is deliberately NOT here: the relay refuses the launch
 * instructions and the platform signs those.
 */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { robots: { index: false, follow: false } };
}

export default function OperatorPage() {
  if (!operatorEnabled()) notFound();
  return <OperatorSettle />;
}
