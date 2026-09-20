// GET /api/ww/diagnose            - health of everything the live tools rely on
// GET /api/ww/diagnose?sig=<sig>  - why one transaction failed
// GET /api/ww/diagnose?code=6014  - what one error code means
//
// The dashboard's buttons. Same checks as scripts/ww-doctor.ts and
// scripts/ww-explain.ts, served so nobody has to open a terminal mid-show.
//
// PER METHOD, NOT PER ENDPOINT. The public RPC throttles each method on its
// own: on 2026-09-20 getTransaction was refused for an hour while
// getAccountInfo and getProgramAccounts answered normally. One ping would have
// called that endpoint healthy and been right about everything except the tool
// that needed it.
//
// Same-origin only. It spends the keyed endpoint per request and every error
// goes through redactSecrets, because an RPC failure message carries the
// endpoint and the endpoint carries the key.
import { PROGRAM_ID, battlePda, b58decode } from "@/lib/ww/pda";
import { quoteBuy, supplyAtPool, SUPPLY_QUANTUM } from "@/lib/ww/quote";
import { programError, decodeSimulationError } from "@/lib/ww/errors";
import { redactSecrets, redactUrl } from "@/lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const KNOWN_BATTLE = 1789790992;
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DISC: Record<string, string> = {
  "28ef8a9a08256a6c": "buyShares", b8a4a910e79ec7c4: "sellShares",
  "82831ded86146ef5": "claimShares", "756ca69f9252f6df": "initializeBattle",
  bd54558eb1c83916: "initializeMints", "5091d030b75ca870": "endBattle",
};

/** What a trader should do about each code. */
const ADVICE: Record<number, string> = {
  6001: "The battle had already ended when it landed. Trading closes at end_time; after that only endBattle and claimShares work.",
  6002: "The battle is still running. endBattle only works after end_time.",
  6003: "The battle was not active when it landed. The chain's clock lags wall time, so a battle that just opened can refuse its first seconds.",
  6006: "An amount the program will not take. On a BUY this is almost always a slippage floor of 0 - zero is rejected there, the minimum is 1. On a sell 0 is allowed, so look at the token amount.",
  6008: "Too small to mint a whole token. Tokens mint in steps of 100,000 and the minimum spend RISES as the pool grows. Nothing was taken.",
  6009: "Not settled yet, so there is nothing to claim. endBattle is permissionless - anyone can settle it.",
  6013: "The deadline passed before it landed. Live clients set 91 to 120 seconds.",
  6014: "The price moved past your slippage floor between signing and landing. Nothing was taken. Retry looser, or smaller.",
  6017: "Nothing to claim on that side - you held none, or it was already claimed.",
  6011: "That battle id is already in use. Ids are start times; pick another second.",
  6012: "The mints already exist for that battle.",
};

async function rpc(method: string, params: unknown[], ms = 20000) {
  const t0 = Date.now();
  try {
    const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), cache: "no-store", signal: AbortSignal.timeout(ms) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.status === 200 && !j.error, status: r.status, err: j.error?.message ?? null, ms: Date.now() - t0, result: j.result };
  } catch (e) {
    return { ok: false, status: 0, err: redactSecrets(String(e instanceof Error ? e.message : e)), ms: Date.now() - t0, result: null };
  }
}

function describe(code: number) {
  const e = programError(code);
  return {
    code,
    name: e?.name ?? null,
    message: e?.message ?? "Not a WaveWarZ error code. Codes below 6000 are Anchor's or the runtime's, so it came from another program.",
    advice: ADVICE[code] ?? null,
    observed: (e as { observed?: string } | null)?.observed ?? null,
  };
}

async function explainSignature(sig: string) {
  const tx = await rpc("getTransaction", [sig, { maxSupportedTransactionVersion: 0, encoding: "json" }]);
  if (!tx.ok) return { status: "error", error: `could not read that signature: ${tx.status} ${tx.err ?? ""}`.trim() };
  if (!tx.result) return { status: "error", error: "no such transaction, or it is older than the node's history" };
  const t = tx.result;
  const la = t.meta?.loadedAddresses;
  const all = [...(t.transaction.message.accountKeys ?? []), ...(la?.writable ?? []), ...(la?.readonly ?? [])];
  const instructions: unknown[] = [];
  t.transaction.message.instructions.forEach((ix: { programIdIndex: number; data: string }, i: number) => {
    if (all[ix.programIdIndex] !== PROGRAM_ID) return;
    const d = b58decode(ix.data);
    const name = DISC[Buffer.from(d.slice(0, 8)).toString("hex")] ?? "unknown";
    const row: Record<string, unknown> = { index: i, name };
    if ((name === "buyShares" || name === "sellShares") && d.length >= 33) {
      const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
      row.amount = Number(v.getBigUint64(8, true));
      row.side = d[16] ? "A" : "B";
      row.slippageFloor = Number(v.getBigUint64(17, true));
      if (name === "buyShares" && row.slippageFloor === 0) row.warning = "a buy floor of 0 is rejected outright by the program";
    }
    instructions.push(row);
  });
  const logs: string[] = t.meta?.logMessages ?? [];
  const decoded = t.meta?.err ? decodeSimulationError(t.meta.err) : null;
  return {
    status: "ok", signature: sig, slot: t.slot,
    blockTime: t.blockTime ? new Date(t.blockTime * 1000).toISOString() : null,
    feePayer: all[0] ?? null, instructions,
    failed: Boolean(t.meta?.err),
    error: decoded ? { ...describe(decoded.code), instructionIndex: decoded.instructionIndex } : null,
    rawError: t.meta?.err ? JSON.stringify(t.meta.err) : null,
    programLogs: logs.filter((l) => l.startsWith("Program log:")).map((l) => l.replace("Program log: ", "")),
  };
}

async function health() {
  const checks: { name: string; ok: boolean; detail: string }[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const pda = battlePda(KNOWN_BATTLE);

  const acct = await rpc("getAccountInfo", [pda, { encoding: "base64" }]);
  add("getAccountInfo", acct.ok, acct.ok ? `${acct.ms}ms` : `${acct.status} ${acct.err ?? ""}`);
  const sigs = await rpc("getSignaturesForAddress", [pda, { limit: 3 }]);
  add("getSignaturesForAddress", sigs.ok, sigs.ok ? `${sigs.ms}ms` : `${sigs.status} ${sigs.err ?? ""}`);
  const firstSig = sigs.ok ? sigs.result?.[0]?.signature : null;
  if (firstSig) {
    const tx = await rpc("getTransaction", [firstSig, { maxSupportedTransactionVersion: 0, encoding: "json" }]);
    add("getTransaction", tx.ok, tx.ok ? `${tx.ms}ms` : `${tx.status} ${tx.err ?? ""} - the explain button needs this`);
  } else add("getTransaction", false, "not tested, no signature to try");

  const gpa = await rpc("getProgramAccounts", [PROGRAM_ID,
    { encoding: "base64", filters: [{ dataSize: 353 }], dataSlice: { offset: 0, length: 256 } }], 30000);
  add("getProgramAccounts", gpa.ok, gpa.ok ? `${gpa.ms}ms, ${(gpa.result ?? []).length} battle accounts` : `${gpa.status} ${gpa.err ?? ""}`);

  if (acct.ok && acct.result?.value) {
    const raw = Buffer.from(acct.result.value.data[0], "base64");
    const pool = Number(raw.readBigUInt64LE(212));
    const supply = Number(raw.readBigUInt64LE(196));
    const drift = supplyAtPool(pool) - supply;
    add("curve model", drift >= 0 && drift < SUPPLY_QUANTUM * 4,
      `stored supply sits ${Math.round(drift).toLocaleString()} below the curve - the expected flooring residual`);
    const q = quoteBuy(pool, 10_000_000);
    add("quote returns whole steps", q.tokensOut > 0 && q.tokensOut % SUPPLY_QUANTUM === 0,
      `${q.tokensOut.toLocaleString()} tokens for 0.01 SOL`);
  }

  let live = 0, awaiting = 0;
  if (gpa.ok) {
    const now = Math.floor(Date.now() / 1000);
    for (const a of gpa.result ?? []) {
      const raw = Buffer.from(a.account.data[0], "base64");
      const id = Number(raw.readBigUInt64LE(8));
      if (id < 1_600_000_000 || id > 2_600_000_000) continue;
      if (raw[245] !== 0) continue;
      if (Number(raw.readBigInt64LE(28)) > now) live++; else awaiting++;
    }
  }
  return {
    status: "ok", readAt: new Date().toISOString(), endpoint: redactUrl(RPC),
    keyed: Boolean(process.env.SOLANA_RPC_URL),
    checks, pass: checks.filter((c) => c.ok).length, fail: checks.filter((c) => !c.ok).length,
    live, awaitingSettlement: awaiting,
  };
}

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  try {
    const code = p.get("code");
    if (code && /^\d{3,5}$/.test(code)) return Response.json({ status: "ok", ...describe(Number(code)) }, { headers: { "Cache-Control": "no-store" } });
    const sig = p.get("sig");
    if (sig) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig)) return Response.json({ status: "error", error: "that does not look like a transaction signature" }, { status: 400 });
      return Response.json(await explainSignature(sig), { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(await health(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ status: "error", error: redactSecrets(String(e instanceof Error ? e.message : e)) }, { status: 502 });
  }
}
