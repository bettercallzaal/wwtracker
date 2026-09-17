// POST /api/ww/trade
//
// The server side of the trading widget. Three actions:
//
//   {"action":"prepare"}                      -> a recent blockhash to build against
//   {"action":"preflight","transaction":b64}  -> simulate, never send
//   {"action":"send","transaction":b64}       -> simulate, then send if it would succeed
//
// WHY THIS EXISTS AT ALL. The browser could talk to an RPC directly, but ours is
// a keyed Helius endpoint and shipping it to the client publishes the key - the
// same key that keeps /live up. So the key stays here and the browser posts
// through. That is the only reason this route exists, and it is why the route is
// deliberately boring.
//
// NOT CORS-OPEN, unlike every other /api/ww/* route. Those serve public reads and
// want to be embedded anywhere; this one spends our RPC budget on request, so it
// answers same-origin callers only. A cross-origin caller gets no CORS headers
// and the browser refuses the response.
//
// `lib/ww/relayPolicy.ts` is what stops it being an open relay: every instruction
// must target an allowed program and at least one must be a buy, sell or claim.
// See that file for why Lighthouse is on the list and why initializeBattle is not.
//
// SIMULATE BEFORE SEND, ALWAYS. A transaction that will fail still costs a fee
// and still takes a slot to find out. Simulating first turns "it failed" into the
// program's own error message - "Battle has already ended" rather than
// "custom program error: 0x1771" - at the cost of one extra RPC call.

import { decideRelay, splitTransaction } from "@/lib/ww/relayPolicy";
import { redactUrl } from "@/lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RPC_SOURCE = redactUrl(RPC);

export const dynamic = "force-dynamic";

/** Big enough for a signed transaction with guards, small enough to refuse a flood. */
const MAX_TRANSACTION_BYTES = 1600;

type Json = Record<string, unknown>;

function json(status: number, body: Json) {
  return new Response(JSON.stringify({ ...body, source: RPC_SOURCE }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc ${method}: HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) {
    // The RPC echoes back parts of the request in some errors, and the request
    // never contains the key - but the URL does, so nothing here interpolates it.
    throw new Error(`rpc ${method}: ${JSON.stringify(body.error).slice(0, 200)}`);
  }
  return body.result as T;
}

/** Decode base64 strictly: a silently-truncated transaction is worse than a 400. */
function decodeTransaction(raw: unknown): Uint8Array {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("transaction must be a base64 string");
  }
  const bytes = new Uint8Array(Buffer.from(raw, "base64"));
  if (bytes.length === 0) throw new Error("transaction did not decode");
  if (Buffer.from(bytes).toString("base64").replace(/=+$/, "") !== raw.replace(/=+$/, "")) {
    throw new Error("transaction is not valid base64");
  }
  if (bytes.length > MAX_TRANSACTION_BYTES) {
    throw new Error(`transaction is ${bytes.length} bytes, over the ${MAX_TRANSACTION_BYTES} limit`);
  }
  return bytes;
}

interface SimulationValue {
  err: unknown;
  logs: string[] | null;
  unitsConsumed?: number;
}

/**
 * Pull the human-readable reason out of simulation logs. Anchor prints
 * "Error Message: Battle has already ended." and that sentence is the entire
 * value of simulating - without it the caller gets a hex code.
 */
function readableError(sim: SimulationValue): string | null {
  if (!sim.err) return null;
  const line = (sim.logs ?? []).find((l) => l.includes("Error Message:"));
  if (line) return line.slice(line.indexOf("Error Message:") + "Error Message:".length).trim();
  const anchor = (sim.logs ?? []).find((l) => l.includes("AnchorError"));
  return anchor ?? JSON.stringify(sim.err);
}

async function simulate(tx: Uint8Array): Promise<SimulationValue> {
  const result = await rpc<{ value: SimulationValue }>("simulateTransaction", [
    Buffer.from(tx).toString("base64"),
    { sigVerify: false, replaceRecentBlockhash: true, encoding: "base64" },
  ]);
  return result.value;
}

export async function POST(request: Request) {
  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return json(400, { status: "error", error: "body must be JSON" });
  }

  const action = body.action;

  if (action === "prepare") {
    try {
      const { value } = await rpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
        "getLatestBlockhash",
        [{ commitment: "confirmed" }],
      );
      return json(200, { status: "ok", ...value });
    } catch (err) {
      return json(502, { status: "error", error: (err as Error).message });
    }
  }

  if (action !== "preflight" && action !== "send") {
    return json(400, { status: "error", error: 'action must be "prepare", "preflight" or "send"' });
  }

  let tx: Uint8Array;
  let message: Uint8Array;
  try {
    tx = decodeTransaction(body.transaction);
    ({ message } = splitTransaction(tx));
  } catch (err) {
    return json(400, { status: "error", error: (err as Error).message });
  }

  const decision = decideRelay(message);
  if (!decision.ok) {
    // 403 rather than 400: the transaction is well-formed and we are declining
    // to forward it, which is a different thing for a caller to debug.
    return json(403, { status: "refused", error: decision.reason });
  }

  let sim: SimulationValue;
  try {
    sim = await simulate(tx);
  } catch (err) {
    return json(502, { status: "error", error: (err as Error).message });
  }

  const wouldFail = readableError(sim);
  if (action === "preflight") {
    return json(200, {
      status: wouldFail ? "would-fail" : "would-succeed",
      error: wouldFail,
      unitsConsumed: sim.unitsConsumed ?? null,
      trades: decision.trades,
      logs: sim.logs ?? [],
    });
  }

  if (wouldFail) {
    // Refusing to spend a fee on a transaction we already know fails.
    return json(200, {
      status: "would-fail",
      error: wouldFail,
      unitsConsumed: sim.unitsConsumed ?? null,
      sent: false,
    });
  }

  try {
    const signature = await rpc<string>("sendTransaction", [
      Buffer.from(tx).toString("base64"),
      { encoding: "base64", skipPreflight: false, maxRetries: 3 },
    ]);
    return json(200, { status: "sent", signature, trades: decision.trades, sent: true });
  } catch (err) {
    return json(502, { status: "error", error: (err as Error).message, sent: false });
  }
}

/** No CORS preflight support: this route is same-origin by design. */
export async function OPTIONS() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
