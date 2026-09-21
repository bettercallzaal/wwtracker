// GET /api/ww/pool-history?battleId=<id>
//
// The pools and supplies of one battle over time, as the watcher recorded
// them: one sample per poll where something changed, plus a heartbeat every
// 30 s so a flat stretch is a measured flat stretch. This is what the battle
// page's chart draws.
//
// IT ANSWERS ONLY FOR BATTLES THE WATCHER WATCHED. There is no chain backfill
// here: a battle from before the store existed, or one that ran while the
// watcher was down, returns 404 `not-recorded`, which is a different answer
// from an empty series. Building the series from trade history is possible
// (every trade's pool delta is on chain) and is a separate piece of work.
//
// No RPC, no upstream: a file read on this machine. Same-origin, no-store.

import { readHistory, DEFAULT_DIR } from "@/lib/poolHistoryStore";
import { chartSeries } from "@/lib/ww/poolHistory";

export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const battleId = new URL(request.url).searchParams.get("battleId") ?? "";
  if (!/^\d{9,12}$/.test(battleId)) {
    return json(400, { status: "error", error: "battleId must be a 9 to 12 digit number" });
  }
  const dir = process.env.WW_LIVE_DIR || DEFAULT_DIR;
  const read = readHistory(dir, Number(battleId));
  if (!read) {
    return json(404, {
      status: "not-recorded",
      error: `no pool history for battle ${battleId}; the watcher did not record it`,
    });
  }
  const series = chartSeries(read.samples);
  return json(200, {
    status: "ok",
    battleId: Number(battleId),
    count: series.length,
    skipped: read.skipped,
    from: series[0]?.t ?? null,
    to: series[series.length - 1]?.t ?? null,
    series,
  });
}
