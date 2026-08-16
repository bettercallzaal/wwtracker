import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_AS_OF } from "@/lib/freshness";

// Revalidate every 60s — matches wavewarz.info/api/public/stats cache TTL.
export const revalidate = 60;

interface StoredBattle {
  id: string;
  type: "MAIN" | "QUICK" | "COMMUNITY" | "UNCLASSIFIED";
  date: string;
  a: string;
  b: string;
  winner: string;
  vol: number;
  margin: number | null;
}

interface TopBattle {
  id: string;
  type: string;
  a: string;
  b: string;
  winner: string;
  vol: number;
  date: string;
}

interface StatsPayload {
  source: "wwtracker-local";
  /** These figures are computed from a frozen snapshot, not live. Always true here. */
  stale: true;
  /** The snapshot's date. This is what the numbers reflect - NOT the request time. */
  asOf: string;
  /** Where to get live platform totals instead. */
  liveTotals: string;
  note: string;
  battles: {
    total: number;
    byType: { MAIN: number; QUICK: number; COMMUNITY: number; UNCLASSIFIED: number };
  };
  volume: {
    totalSol: number;
    avgPerBattleSol: number;
    topBattle: TopBattle;
  };
  dateRange: {
    earliest: string;
    latest: string;
  };
  /** When this response was assembled. The data itself is as of `asOf`. */
  computedAt: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(): Promise<NextResponse> {
  let battles: StoredBattle[];
  try {
    const raw = readFileSync(
      join(process.cwd(), "public", "ww-battles.json"),
      "utf-8",
    );
    battles = JSON.parse(raw) as StoredBattle[];
  } catch {
    return NextResponse.json(
      { error: "Failed to load battles data" },
      { status: 500, headers: CORS },
    );
  }

  const byType = { MAIN: 0, QUICK: 0, COMMUNITY: 0, UNCLASSIFIED: 0 };
  let totalVol = 0;
  let top: StoredBattle | null = null;
  const dates: string[] = [];

  for (const b of battles) {
    byType[b.type] = (byType[b.type] ?? 0) + 1;
    totalVol += b.vol ?? 0;
    if (!top || b.vol > top.vol) top = b;
    if (b.date) dates.push(b.date);
  }

  const payload: StatsPayload = {
    source: "wwtracker-local",
    stale: true,
    asOf: DATA_AS_OF,
    liveTotals: "/api/ww/stats",
    note:
      "HISTORICAL ANALYTICS, NOT LIVE. Computed from a frozen battle snapshot " +
      `(public/ww-battles.json, as of ${DATA_AS_OF}). These figures do not update - ` +
      "for live platform totals use /api/ww/stats. This endpoint exists for the " +
      "richer per-battle breakdowns (top battle, by-type, avg per battle) that the " +
      "live stats endpoint does not compute.",
    battles: {
      total: battles.length,
      byType,
    },
    volume: {
      totalSol: Math.round(totalVol * 10000) / 10000,
      avgPerBattleSol: battles.length
        ? Math.round((totalVol / battles.length) * 10000) / 10000
        : 0,
      topBattle: top
        ? { id: top.id, type: top.type, a: top.a, b: top.b, winner: top.winner, vol: top.vol, date: top.date }
        : { id: "", type: "", a: "", b: "", winner: "", vol: 0, date: "" },
    },
    dateRange: {
      earliest: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : "",
      latest: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "",
    },
    // When this response was assembled. The DATA is as of `asOf`, not this.
    computedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, { headers: CORS });
}
