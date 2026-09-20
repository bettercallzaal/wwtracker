/**
 * The live dashboard, behind `WW_FINALS`.
 *
 * A SERVER WRAPPER AROUND A CLIENT BODY, because the gate has to run on the
 * server: `finalsEnabled` reads `process.env`, and a flag a browser can see is
 * not a gate. The dashboard itself is a client component - it recomputes every
 * quote as the spend box changes, from the same `lib/ww/quote` the SDK uses,
 * and a round trip per keystroke would be absurd.
 *
 * OFF BY DEFAULT. Not for secrecy - the page shows only public chain data -
 * but for RPC budget. See `lib/finalsFlag.ts` for what it costs and why it is
 * gated.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { finalsEnabled } from "@/lib/finalsFlag";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WaveWarZ live",
  description: "Live battles, what a spend buys on each side, and the health of the tools behind it.",
  robots: { index: false, follow: false },
};

export default function FinalsPage() {
  if (!finalsEnabled()) notFound();
  return <Dashboard />;
}
