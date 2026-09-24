import { notFound } from "next/navigation";
import LaunchBattle from "@/components/LaunchBattle";
import { launchEnabled } from "@/lib/ww/launchFlag";
import { C, metaLabel } from "@/lib/theme";

/**
 * /launch - create a battle of our own.
 *
 * 404 unless `WW_LAUNCH` is on, the same shape as /widget and /operator: not a
 * hidden link, not a refusal, nothing to find. Creating a battle spends real
 * SOL and puts accounts on mainnet, so the page that does it does not exist on
 * a deployment that has not asked for it.
 */
export const dynamic = "force-dynamic";

export default function LaunchPage() {
  if (!launchEnabled()) notFound();
  const panel = {
    background: C.panel,
    border: `1px solid ${C.grid}`,
    borderRadius: 10,
    padding: 16,
  } as const;
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Launch a battle</h1>
      <p style={{ ...metaLabel, marginBottom: 14 }}>community battles, run by us</p>
      <p style={{ fontSize: 13, color: C.dim, marginBottom: 16 }}>
        The WaveWarZ program is permissionless for launching: any wallet can create a battle, not
        only the platform. Established by simulation on 2026-09-24 from a wallet that is not the
        platform treasury. This page builds both launch instructions, checks them against the
        program before asking you to sign, and shows what it costs.
      </p>
      <div style={panel}>
        <LaunchBattle />
      </div>
      <p style={{ fontSize: 12, color: C.dim, marginTop: 14 }}>
        Two instructions, one transaction. <code>initializeBattle</code> on its own leaves a battle
        nobody can trade, because the mints a buy needs do not exist yet - so they are never sent
        apart.
      </p>
    </main>
  );
}
