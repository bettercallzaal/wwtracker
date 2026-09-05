import "server-only";
import { normalizeRows } from "./dune-normalize";
import { parseExecutionEndedAt } from "./refresh-policy";
import type { BalanceRow } from "./dune-normalize";

export type { BalanceRow };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DuneFetchResult {
  rows: BalanceRow[];
  /** Where the rows came from - useful for the UI badge / debugging. */
  origin: "cache" | "execute";
}

/** Dune parameter names as defined in the saved query. */
const PARAM_WALLET = "wallet";
const PARAM_MINT = "mint";

const DUNE_BASE = "https://api.dune.com/api/v1";
const RESULT_LIMIT = 2000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DuneError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DuneError";
  }
}

// ---------------------------------------------------------------------------
// In-memory TTL cache (per server instance). Keyed by wallet+mint so a repeat
// execute for the same series within the TTL is served from memory, sparing a
// Dune credit. Best-effort only - a cold lambda starts empty.
// ---------------------------------------------------------------------------

const TTL_MS = 12 * 60 * 60 * 1000; // 12h

interface CacheEntry {
  expires: number;
  result: DuneFetchResult;
}

const executeCache = new Map<string, CacheEntry>();

function cacheKey(wallet: string, mint?: string): string {
  return `${wallet}::${mint ?? "native"}`;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function duneFetch(
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${DUNE_BASE}${path}`, {
    ...init,
    headers: {
      "X-Dune-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

// ---------------------------------------------------------------------------
// Cached read - default wallet path. Reads the saved query's last results.
// ---------------------------------------------------------------------------

export interface LatestResults {
  rows: BalanceRow[];
  /**
   * Epoch ms of the execution these rows came from, or null if Dune did not
   * report one. This is what tells the refresh path whether re-running the
   * query would buy anything - see lib/refresh-policy.ts.
   */
  executionEndedAt: number | null;
}

export async function getLatestResults(
  queryId: string,
  apiKey: string,
): Promise<LatestResults> {
  // no-store: we read Dune's already-cached query results (cheap, no execute),
  // so we don't want Vercel's persistent Data Cache pinning a stale copy across
  // deploys. Freshness comes from Dune re-running the query (cron / manual).
  const res = await duneFetch(
    `/query/${queryId}/results?limit=${RESULT_LIMIT}`,
    apiKey,
    { cache: "no-store" } as RequestInit,
  );
  if (!res.ok) {
    throw new DuneError(
      `Dune cached results failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const json = (await res.json()) as { result?: { rows?: unknown } };
  return {
    rows: normalizeRows(json.result?.rows),
    // The timestamps sit on the envelope, alongside `result`, not inside it.
    executionEndedAt: parseExecutionEndedAt(json),
  };
}

export async function getLatestBalances(
  queryId: string,
  apiKey: string,
): Promise<BalanceRow[]> {
  return (await getLatestResults(queryId, apiKey)).rows;
}

// ---------------------------------------------------------------------------
// Generic cached read - returns the raw rows of any saved query's last run.
// Used by the WaveWarZ analytics panels (each panel = one saved Dune query
// whose cached results we read cheaply, same frugal pattern as the balance).
// ---------------------------------------------------------------------------

export async function getCachedRows<T = Record<string, unknown>>(
  queryId: string,
  apiKey: string,
  limit = 5000,
): Promise<T[]> {
  const res = await duneFetch(
    `/query/${queryId}/results?limit=${limit}`,
    apiKey,
    { next: { revalidate: 43200 } } as RequestInit,
  );
  if (!res.ok) {
    throw new DuneError(
      `Dune cached results failed: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const json = (await res.json()) as { result?: { rows?: unknown } };
  const rows = json.result?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

// ---------------------------------------------------------------------------
// Execute path - any non-default wallet (and/or SPL mint). POST execute,
// poll status until completed (capped), then fetch results.
// ---------------------------------------------------------------------------

interface ExecuteOpts {
  wallet: string;
  mint?: string;
  /** Max time to wait for the execution to complete. */
  timeoutMs?: number;
  /** Poll interval. */
  pollMs?: number;
}

export async function executeForWallet(
  queryId: string,
  apiKey: string,
  opts: ExecuteOpts,
): Promise<DuneFetchResult> {
  const { wallet, mint, timeoutMs = 60_000, pollMs = 2_000 } = opts;

  const key = cacheKey(wallet, mint);
  const cached = executeCache.get(key);
  if (cached && cached.expires > nowMs()) {
    return cached.result;
  }

  const query_parameters: Record<string, string> = { [PARAM_WALLET]: wallet };
  if (mint) query_parameters[PARAM_MINT] = mint;

  // 1. Kick off execution.
  const execRes = await duneFetch(`/query/${queryId}/execute`, apiKey, {
    method: "POST",
    body: JSON.stringify({ query_parameters }),
  });
  if (!execRes.ok) {
    throw new DuneError(
      `Dune execute failed: ${execRes.status} ${execRes.statusText}`,
      execRes.status,
    );
  }
  const execJson = (await execRes.json()) as { execution_id?: string };
  const executionId = execJson.execution_id;
  if (!executionId) {
    throw new DuneError("Dune execute returned no execution_id");
  }

  // 2. Poll status until terminal or timeout.
  const deadline = nowMs() + timeoutMs;
  let state = "";
  while (nowMs() < deadline) {
    const statusRes = await duneFetch(
      `/execution/${executionId}/status`,
      apiKey,
    );
    if (!statusRes.ok) {
      throw new DuneError(
        `Dune status failed: ${statusRes.status} ${statusRes.statusText}`,
        statusRes.status,
      );
    }
    const statusJson = (await statusRes.json()) as { state?: string };
    state = statusJson.state ?? "";

    if (state === "QUERY_STATE_COMPLETED") break;
    if (state === "QUERY_STATE_FAILED" || state === "QUERY_STATE_CANCELLED") {
      throw new DuneError(`Dune execution ${state} for wallet ${wallet}`);
    }
    await sleep(pollMs);
  }

  if (state !== "QUERY_STATE_COMPLETED") {
    throw new DuneError(
      `Dune execution timed out after ${Math.round(timeoutMs / 1000)}s for wallet ${wallet}`,
    );
  }

  // 3. Fetch results.
  const resultsRes = await duneFetch(
    `/execution/${executionId}/results?limit=${RESULT_LIMIT}`,
    apiKey,
  );
  if (!resultsRes.ok) {
    throw new DuneError(
      `Dune results failed: ${resultsRes.status} ${resultsRes.statusText}`,
      resultsRes.status,
    );
  }
  const resultsJson = (await resultsRes.json()) as {
    result?: { rows?: unknown };
  };
  const rows = normalizeRows(resultsJson.result?.rows);

  const result: DuneFetchResult = { rows, origin: "execute" };
  executeCache.set(key, { expires: nowMs() + TTL_MS, result });
  return result;
}

// ---------------------------------------------------------------------------
// Refresh path - re-run the saved query itself, no parameters.
//
// This exists because `getLatestBalances` only READS whatever execution Dune
// last completed. Nothing in this app ever asked Dune to run the query again,
// so the treasury series silently froze: on 2026-09-05 the saved query's newest
// row was 2026-07-03, 64 days old, while the app and the docs both described
// section 02 Floor as "live". Reading a cache faithfully is not the same as
// being current. The daily Vercel cron now calls this instead.
//
// Deliberately separate from executeForWallet: query 7717935 declares no
// parameters, so posting a `query_parameters` body at it is wrong. This just
// says "run yourself" and waits.
// ---------------------------------------------------------------------------

export async function executeSavedQuery(
  queryId: string,
  apiKey: string,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<DuneFetchResult> {
  const { timeoutMs = 90_000, pollMs = 3_000 } = opts;

  const execRes = await duneFetch(`/query/${queryId}/execute`, apiKey, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!execRes.ok) {
    throw new DuneError(
      `Dune execute failed: ${execRes.status} ${execRes.statusText}`,
      execRes.status,
    );
  }
  const executionId = ((await execRes.json()) as { execution_id?: string })
    .execution_id;
  if (!executionId) throw new DuneError("Dune execute returned no execution_id");

  const deadline = nowMs() + timeoutMs;
  let state = "";
  while (nowMs() < deadline) {
    const statusRes = await duneFetch(`/execution/${executionId}/status`, apiKey);
    if (!statusRes.ok) {
      throw new DuneError(
        `Dune status failed: ${statusRes.status} ${statusRes.statusText}`,
        statusRes.status,
      );
    }
    state = ((await statusRes.json()) as { state?: string }).state ?? "";
    if (state === "QUERY_STATE_COMPLETED") break;
    if (state === "QUERY_STATE_FAILED" || state === "QUERY_STATE_CANCELLED") {
      throw new DuneError(`Dune execution ${state} for query ${queryId}`);
    }
    await sleep(pollMs);
  }
  if (state !== "QUERY_STATE_COMPLETED") {
    throw new DuneError(
      `Dune refresh timed out after ${Math.round(timeoutMs / 1000)}s for query ${queryId}`,
    );
  }

  const resultsRes = await duneFetch(
    `/execution/${executionId}/results?limit=${RESULT_LIMIT}`,
    apiKey,
  );
  if (!resultsRes.ok) {
    throw new DuneError(
      `Dune results failed: ${resultsRes.status} ${resultsRes.statusText}`,
      resultsRes.status,
    );
  }
  const resultsJson = (await resultsRes.json()) as { result?: { rows?: unknown } };
  return { rows: normalizeRows(resultsJson.result?.rows), origin: "execute" };
}

// ---------------------------------------------------------------------------
// Small utils (kept here so the module is self-contained / server-only).
// ---------------------------------------------------------------------------

function nowMs(): number {
  return Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
