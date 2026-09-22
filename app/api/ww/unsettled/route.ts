// GET /api/ww/unsettled
//
// Every battle past its end time whose winner_decided byte is still 0, with
// the raw account slice the settle instruction needs and a preview of what
// the program will do. Feeds /operator.
//
// GATED WITH THE PAGE IT FEEDS, like /api/ww/live-battles: a getProgramAccounts
// over about 1,700 accounts per request is the expensive read, and it answers
// only where WW_OPERATOR is set. Same-origin, no-store, keyed RPC never
// printed.
//
// Decoded through lib/ww/discovery.ts, the same parser the watcher and the
// finals page use, so the definition of "awaiting settlement" is one function.

import { battleDiscoveryRequest, parseBattleAccounts, awaitingSettlement, type ProgramAccountRow } from "@/lib/ww/discovery";
import { operatorEnabled } from "@/lib/ww/operatorFlag";
import { settlePreview } from "@/lib/ww/settle";
import { redactSecrets, redactUrl } from "@/lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RPC_SOURCE = redactUrl(RPC);

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify({ ...body, source: RPC_SOURCE }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET() {
  if (!operatorEnabled()) return new Response("not found", { status: 404 });
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(battleDiscoveryRequest()),
      cache: "no-store",
    });
    if (!res.ok) return json(502, { status: "error", error: `rpc HTTP ${res.status}` });
    const body = await res.json();
    if (body.error) return json(502, { status: "error", error: redactSecrets(JSON.stringify(body.error).slice(0, 200)) });

    const rows = (body.result ?? []) as ProgramAccountRow[];
    const now = Math.floor(Date.now() / 1000);
    const decode = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
    const all = parseBattleAccounts(rows, decode, now);
    const byId = new Map(rows.map((r) => [r.pubkey, r.account.data[0]]));
    const awaiting = awaitingSettlement(all).map((b) => {
      const raw = decode(byId.get(b.pubkey)!);
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      return {
        battleId: b.battleId,
        pubkey: b.pubkey,
        startTime: b.startTime,
        endTime: b.endTime,
        poolLamports: b.poolLamports,
        supply: { a: Number(dv.getBigUint64(196, true)), b: Number(dv.getBigUint64(204, true)) },
        // The 256-byte discovery slice holds the three wallets the instruction
        // names (36, 68, 100), so the page builds endBattle from this alone.
        account: byId.get(b.pubkey),
        preview: settlePreview(b.poolLamports.a, b.poolLamports.b),
      };
    });
    return json(200, {
      status: "ok",
      readAt: new Date().toISOString(),
      now,
      scanned: all.length,
      count: awaiting.length,
      battles: awaiting,
    });
  } catch (err) {
    return json(502, { status: "error", error: redactSecrets((err as Error).message) });
  }
}
