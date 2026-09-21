// GET /api/ww/token-balance?battleId=123&wallet=<address>
//
// How many tokens this wallet holds on each side of one battle, read now.
//
// WHY THIS EXISTS. The widget's sell path needs the seller's balance: to cap
// the amount, to offer "max", and to show what share of the side is leaving.
// /api/ww/claimable answers a wider question (every position across every
// battle, three batched reads) and costs accordingly. This is two
// getTokenAccountBalance calls on two derived addresses and nothing else.
//
// AN ABSENT ACCOUNT IS ZERO; ANY OTHER FAILURE IS AN ERROR. A wallet that has
// never traded this battle has no associated token account, and the RPC says
// "could not find account" rather than 0. That one message is answered as a
// balance of 0 with `exists: false`. A node that is behind, a rate limit, a
// malformed reply: those are 502s, because reporting 0 for them would tell a
// holder they hold nothing. See parseTokenAccountBalance.
//
// Same-origin only and rate limited on the relay's budget, like
// /api/ww/claimable: it spends the keyed RPC on a caller-supplied address.

import { associatedTokenAddress, mintPda } from "@/lib/ww/pda";
import { parseTokenAccountBalance } from "@/lib/ww/widgetSell";
import { RelayBudget, callerKey } from "@/lib/ww/rateLimit";
import { redactSecrets, redactUrl } from "@/lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RPC_SOURCE = redactUrl(RPC);

export const dynamic = "force-dynamic";
export const revalidate = 0;

const budget = new RelayBudget();
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function json(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ ...body, source: RPC_SOURCE }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

async function balanceOf(ata: string): Promise<{ amount: number; exists: boolean }> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountBalance", params: [ata] }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`rpc getTokenAccountBalance: HTTP ${res.status}`);
  return parseTokenAccountBalance(await res.json());
}

export async function GET(request: Request) {
  const decision = budget.take(callerKey(request.headers));
  if (!decision.allowed) {
    return json(429, { status: "error", error: decision.reason }, { "Retry-After": String(decision.retryAfter) });
  }

  const url = new URL(request.url);
  const battleId = url.searchParams.get("battleId") ?? "";
  const wallet = url.searchParams.get("wallet")?.trim() ?? "";
  if (!/^\d{9,12}$/.test(battleId)) {
    return json(400, { status: "error", error: "battleId must be a 9 to 12 digit number" });
  }
  if (!ADDRESS.test(wallet)) {
    return json(400, { status: "error", error: "wallet must be a base58 address" });
  }

  const id = Number(battleId);
  const ata = {
    a: associatedTokenAddress(wallet, mintPda(id, "a")),
    b: associatedTokenAddress(wallet, mintPda(id, "b")),
  };

  try {
    const [a, b] = await Promise.all([balanceOf(ata.a), balanceOf(ata.b)]);
    return json(200, {
      status: "ok",
      battleId: id,
      wallet,
      readAt: new Date().toISOString(),
      // Base units, as the mint counts them and as sellShares takes them.
      balances: { a: a.amount, b: b.amount },
      exists: { a: a.exists, b: b.exists },
      tokenAccounts: ata,
    });
  } catch (err) {
    return json(502, { status: "error", error: redactSecrets((err as Error).message) });
  }
}
