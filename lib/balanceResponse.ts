// What a /api/balance response means for a surface that shows the treasury.
//
// OnChainProof - the "Treasury now" tile at the top of the homepage - decided
// "live" as `source !== "sample"`. The route only ever sends `source: "live"`,
// on success; every failure (503 when Dune is not configured, 400, 500) sends an
// error body with NO source field. So every failure classified as live: the tile
// rendered "-" and "peak 0.00" under a footer reading "treasury live from
// Solana." Measured on a preview deploy on 2026-09-10, where the route answers
// 503 {"error":"Dune not configured"}. Production was healthy at the time; a
// Dune outage there would have looked exactly the same.
//
// Same inverted alarm this repo keeps meeting: the less the response said, the
// healthier it was reported. So live is an ALLOWLIST - HTTP 200, source exactly
// "live", and at least one row. Everything else says why it is not live.

export interface BalanceRow {
  block_date: string;
  eod_sol_balance: number;
}

export type BalanceState =
  | { live: true; rows: BalanceRow[] }
  | { live: false; rows: []; reason: string };

export function classifyBalanceResponse(httpStatus: number, body: unknown): BalanceState {
  const b = (body && typeof body === "object" ? body : {}) as {
    source?: unknown;
    rows?: unknown;
    error?: unknown;
  };
  if (httpStatus !== 200) {
    const why = typeof b.error === "string" ? b.error : "no error message";
    return { live: false, rows: [], reason: `HTTP ${httpStatus}: ${why}` };
  }
  if (b.source !== "live") {
    return { live: false, rows: [], reason: `source is ${JSON.stringify(b.source ?? null)}, not "live"` };
  }
  if (!Array.isArray(b.rows) || b.rows.length === 0) {
    return { live: false, rows: [], reason: "no balance rows" };
  }
  return { live: true, rows: b.rows as BalanceRow[] };
}
