// GET /api/ww/live-battles
//
// Every battle running right now, decoded from one getProgramAccounts.
//
// WHY A ROUTE AND NOT A CLIENT FETCH. getProgramAccounts is the most expensive
// call this estate makes, and `SOLANA_RPC_URL` must not reach a browser. So it
// happens here, once per request, and the page polls this instead of the chain.
//
// Since 2026-09-23 it asks the RPC for only the UNSETTLED accounts - 82 rather
// than 1,702 - because every row this route keeps is unsettled anyway. The
// watcher was refused roughly a quarter of its scans after a day of asking for
// all of them, which is what prompted looking here too.
//
// It returns awaiting-settlement battles too, because "past its end time and
// never settled" is its own state - a claim against one of those returns
// BattleNotEnded, and a dashboard that showed it as finished would be lying in
// the direction that costs somebody money.
import { battleDiscoveryRequest } from "@/lib/ww/discovery";
import { redactSecrets, redactUrl } from "@/lib/redact";
import { finalsEnabled } from "@/lib/finalsFlag";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  // GATED WITH THE PAGE IT FEEDS. This is the expensive one - a
  // getProgramAccounts over ~1,700 accounts, per request, polled every five
  // seconds per viewer. Leaving the route open while hiding the page would
  // leave the cost open and only the convenience hidden.
  if (!finalsEnabled()) return new Response("not found", { status: 404 });
  // Parsed BEFORE the scan, because it decides which scan to make.
  const pinned = new URL(request.url).searchParams.get("battle");
  const pinnedId = pinned && /^\d{9,12}$/.test(pinned) ? Number(pinned) : null;
  try {
    // ASK THE RPC FOR THE UNSETTLED ONES, except when a battle is pinned.
    // Every row this route keeps is unsettled - a settled battle is neither
    // live nor awaiting settlement - so the filter changes nothing it returns
    // while cutting the response from 1,702 accounts and 975 KB to 82 and
    // 47 KB (measured 2026-09-23). A PIN is the exception and the reason this
    // is conditional: pinning a battle deliberately returns it whatever its
    // phase, including settled, so the page's cards can be exercised when
    // nothing is running. Filtering then would silently return nothing.
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(battleDiscoveryRequest(undefined, pinnedId === null)),
      cache: "no-store",
    });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message ?? "rpc error");
    const now = Math.floor(Date.now() / 1000);
    // A pinned id is returned as `live` whatever its phase, so the page's card
    // rendering can be exercised while nothing is running. The phase fields are
    // untouched, so a pinned settled battle still reports itself as settled.
    const live: unknown[] = [];
    const awaiting: unknown[] = [];
    for (const a of j.result ?? []) {
      const raw = Buffer.from(a.account.data[0], "base64");
      const battleId = Number(raw.readBigUInt64LE(8));
      // The id is a start time; anything outside that range is not a battle.
      if (battleId < 1_600_000_000 || battleId > 2_600_000_000) continue;
      const endTime = Number(raw.readBigInt64LE(28));
      const decided = raw[245] !== 0;
      const row = {
        battleId, endTime,
        startTime: Number(raw.readBigInt64LE(20)),
        pool: { a: Number(raw.readBigUInt64LE(212)), b: Number(raw.readBigUInt64LE(220)) },
        supply: { a: Number(raw.readBigUInt64LE(196)), b: Number(raw.readBigUInt64LE(204)) },
        winnerDecided: decided,
        winnerArtistA: raw[244] !== 0,
      };
      if (pinnedId !== null) { if (battleId === pinnedId) live.push(row); continue; }
      if (!decided && endTime > now) live.push(row);
      else if (!decided) awaiting.push(row);
    }
    return new Response(JSON.stringify({
      status: "ok", readAt: new Date().toISOString(), now,
      live, awaitingSettlement: awaiting.length, source: redactUrl(RPC),
    }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (e) {
    // THROUGH redactSecrets, NOT RAW. An RPC failure message can carry the
    // endpoint, and the endpoint carries the key. Caught by
    // routeErrorRedaction.test.ts, which is the only reason this route does not
    // ship a way to read SOLANA_RPC_URL out of a 502.
    return new Response(JSON.stringify({ status: "error", error: redactSecrets(String(e instanceof Error ? e.message : e)), source: redactUrl(RPC) }),
      { status: 502, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
}
