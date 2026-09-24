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
import { anyConsumerEnabled, notFoundResponse } from "@/lib/ww/apiSurface";
import { launchEnabled } from "@/lib/ww/launchFlag";
import { decodeSimulationError, explainSimulationError } from "@/lib/ww/errors";
import { RelayBudget, callerKey } from "@/lib/ww/rateLimit";
import { confirmSignature, type SignatureStatus } from "@/lib/ww/confirm";
import { redactUrl, redactSecrets } from "@/lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RPC_SOURCE = redactUrl(RPC);

export const dynamic = "force-dynamic";

/** Big enough for a signed transaction with guards, small enough to refuse a flood. */
const MAX_TRANSACTION_BYTES = 1600;

/**
 * Module scope, so it survives between requests on one instance. Per instance
 * is the known limit of doing this in memory - see lib/ww/rateLimit.ts.
 */
const budget = new RelayBudget();

/**
 * `prepare` needs no transaction and spends an RPC call, which made it the
 * cheapest thing on this route to abuse. A blockhash stays valid for about a
 * minute, so serving one a few seconds old costs a caller nothing and collapses
 * any number of calls into one upstream request. That removes the amplification
 * rather than merely rationing it, which is the better fix where it is available.
 */
// 4 s, halved from 8 s on 2026-09-21. A finalized blockhash starts about 13 s
// old, so the cache's own age is now a meaningful share of the window a person
// has to approve in their wallet, and this route's traffic is one human.
const BLOCKHASH_CACHE_MS = 4_000;
let blockhashCache: { at: number; value: { blockhash: string; lastValidBlockHeight: number } } | null = null;

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
  if (!res.ok) throw new Error(redactSecrets(`rpc ${method}: HTTP ${res.status}`));
  const body = await res.json();
  if (body.error) {
    // The RPC echoes back parts of the request in some errors, and the request
    // never contains the key - but the URL does, so nothing here interpolates it.
    throw new Error(redactSecrets(`rpc ${method}: ${JSON.stringify(body.error).slice(0, 200)}`));
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
 *
 * THE LAST RESORT USED TO BE `JSON.stringify(sim.err)`, which puts
 * `{"InstructionError":[2,{"Custom":6001}]}` in front of a person. Logs are the
 * better source when they arrive - they are the program's own words - but they
 * are truncated by the RPC often enough to matter, and a code is not an
 * explanation. `explainSimulationError` decodes it against the program's error
 * list, so the fallback is now a sentence and the raw shape is only reached for
 * something genuinely unrecognised.
 */
function readableError(sim: SimulationValue): string | null {
  if (!sim.err) return null;
  const line = (sim.logs ?? []).find((l) => l.includes("Error Message:"));
  if (line) return line.slice(line.indexOf("Error Message:") + "Error Message:".length).trim();
  const anchor = (sim.logs ?? []).find((l) => l.includes("AnchorError"));
  if (anchor) return anchor;
  if (decodeSimulationError(sim.err)) return explainSimulationError(sim.err);
  return JSON.stringify(sim.err);
}

async function simulate(tx: Uint8Array): Promise<SimulationValue> {
  const result = await rpc<{ value: SimulationValue }>("simulateTransaction", [
    Buffer.from(tx).toString("base64"),
    { sigVerify: false, replaceRecentBlockhash: true, encoding: "base64" },
  ]);
  return result.value;
}

export async function POST(request: Request) {
  // Gated with the interface it serves (see lib/ww/apiSurface.ts). Zaal's
  // ruling 2026-09-22: restrict these, do not merely describe them.
  if (!anyConsumerEnabled(["trading", "operator"]) && !launchEnabled()) return notFoundResponse();
  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return json(400, { status: "error", error: "body must be JSON" });
  }

  const action = body.action;

  // Every action below can cause an upstream call, so the budget is taken before
  // any of them - including for a request that later turns out to be malformed.
  // Charging only well-formed requests would leave a free channel open.
  const spend = budget.take(callerKey(request.headers));
  if (!spend.allowed) {
    return new Response(
      JSON.stringify({ status: "rate-limited", error: spend.reason, source: RPC_SOURCE }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Retry-After": String(spend.retryAfter),
        },
      },
    );
  }

  // THREE READS THE LAUNCH SCREEN NEEDS, and nothing else does. They exist
  // here rather than as their own route because they spend the same keyed RPC
  // and must sit behind the same gate and the same budget. Each is a read: no
  // transaction, no signature, nothing sent.
  //
  // They answer only where launching is enabled. On a deployment that just
  // trades, a caller asking for rent or a fee quote is asking for something no
  // screen there needs.
  if (action === "rent" || action === "fee" || action === "balance") {
    if (!launchEnabled()) return notFoundResponse();
    try {
      if (action === "rent") {
        const bytes = (body as { bytes?: unknown }).bytes;
        // An allowlist, not a range: these are the only account sizes a launch
        // creates, and a free-form number would make this a way to ask our
        // keyed endpoint arbitrary questions.
        if (bytes !== 0 && bytes !== 82 && bytes !== 353) {
          return json(400, { status: "error", error: `rent is quoted only for launch accounts, not ${String(bytes)} bytes` });
        }
        const lamports = await rpc<any>("getMinimumBalanceForRentExemption", [bytes]);
        if (typeof lamports !== "number") {
          return json(502, { status: "error", error: "the cluster did not quote a rent figure" });
        }
        return json(200, { status: "ok", bytes, lamports });
      }
      if (action === "fee") {
        const message = (body as { message?: unknown }).message;
        if (typeof message !== "string" || message.length === 0) {
          return json(400, { status: "error", error: "message must be a base64 string" });
        }
        const res = await rpc<any>("getFeeForMessage", [message, { commitment: "processed" }]);
        // A cluster that will not quote a fee returns null here, and the
        // client turns that into a FLOOR rather than into zero.
        return json(200, { status: "ok", lamports: typeof res?.value === "number" ? res.value : null });
      }
      const address = (body as { address?: unknown }).address;
      if (typeof address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
        return json(400, { status: "error", error: "address must be base58" });
      }
      const res = await rpc<any>("getBalance", [address]);
      return json(200, { status: "ok", lamports: typeof res?.value === "number" ? res.value : null });
    } catch (err) {
      return json(502, { status: "error", error: redactSecrets((err as Error).message) });
    }
  }

  if (action === "prepare") {
    const now = Date.now();
    if (blockhashCache && now - blockhashCache.at < BLOCKHASH_CACHE_MS) {
      return json(200, { status: "ok", ...blockhashCache.value, cached: true });
    }
    try {
      // FINALIZED, NOT CONFIRMED, AND THE DIFFERENCE IS A FAILED TRADE.
      //
      // Measured live twice on 2026-09-21, battle 1790044803: a trade the
      // program had already accepted in simulation came back from send with
      // {"err":"BlockhashNotFound"}. A public RPC endpoint is a POOL of
      // machines. The blockhash was read from whichever node answered
      // `prepare`, and the transaction was sent to whichever node answered
      // `send` - a different one, a beat behind, which had never heard of that
      // block. Nothing was wrong with the transaction.
      //
      // A finalized blockhash is about 13 s older, so every node in the pool
      // already has it, and it still leaves the better part of a minute of the
      // roughly 60 s validity window for a person to read a simulation and
      // press approve in their wallet. Trading a few seconds of headroom for
      // an error that cannot be retried out of is the right way round.
      const { value } = await rpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
        "getLatestBlockhash",
        [{ commitment: "finalized" }],
      );
      blockhashCache = { at: now, value };
      return json(200, { status: "ok", ...value, cached: false });
    } catch (err) {
      return json(502, { status: "error", error: redactSecrets((err as Error).message) });
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
    return json(400, { status: "error", error: redactSecrets((err as Error).message) });
  }

  // Launch instructions are forwarded only where WW_LAUNCH is on. Read here
  // rather than defaulted in the policy, so the policy's default stays closed.
  const decision = decideRelay(message, { allowLaunch: launchEnabled() });
  if (!decision.ok) {
    // 403 rather than 400: the transaction is well-formed and we are declining
    // to forward it, which is a different thing for a caller to debug.
    return json(403, { status: "refused", error: decision.reason });
  }

  let sim: SimulationValue;
  try {
    sim = await simulate(tx);
  } catch (err) {
    return json(502, { status: "error", error: redactSecrets((err as Error).message) });
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

  let signature: string;
  try {
    signature = await rpc<string>("sendTransaction", [
      Buffer.from(tx).toString("base64"),
      { encoding: "base64", skipPreflight: false, maxRetries: 3 },
    ]);
  } catch (err) {
    return json(502, { status: "error", error: redactSecrets((err as Error).message), sent: false });
  }

  // "SENT" IS NOT "LANDED". Until 2026-09-22 this returned success the moment
  // sendTransaction gave back a signature, and both panels showed a green Sent.
  // That signature means a node accepted the broadcast, nothing more: the
  // transaction can still expire or be dropped and never land. So the route
  // now waits for the cluster's own word, up to about 20 s, and reports one of
  // three things - landed, failed (with the chain's error), or unknown. Unknown
  // is NOT a failure and is never reported as one: the transaction may land a
  // moment later, and a person told it failed might trade twice.
  //
  // Done here rather than by the client polling a status action, because
  // every request on this route costs a unit of a small per-caller budget and
  // a dozen polls would exhaust it; one request, one unit, one answer.
  const confirmation = await confirmSignature({
    readStatus: async () => {
      const r = await rpc<{ value: Array<SignatureStatus | null> }>("getSignatureStatuses", [[signature], { searchTransactionHistory: false }]);
      return r.value[0] ?? null;
    },
    attempts: 10,
    delayMs: 2_000,
  });
  return json(200, {
    // Kept for callers that only know "sent"; the new field is what to read.
    status: "sent",
    signature,
    trades: decision.trades,
    sent: true,
    confirmation,
  });
}

/** No CORS preflight support: this route is same-origin by design. */
export async function OPTIONS() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
