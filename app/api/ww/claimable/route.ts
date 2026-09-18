// GET /api/ww/claimable?wallet=<address>
//
// What this wallet can claim, read at request time. Three batched RPC calls and
// no stored state of any kind.
//
// WHY IT IS A LIVE READ AND NOT A LIST. `recon/UNCLAIMED.md` in the protocol
// repo ruled against a page of wallets with money waiting, because the page
// going stale is the page working: everyone who reads it and claims makes a row
// false, and the failure is telling somebody they are owed money they already
// took. Measured drift was 1.76% in one quiet day. The endorsed shape is this
// one - ask about a wallet, read now, answer now.
//
// So there is NO cache here. Not of balances, not of the battle list, not of
// the mint-to-battle mapping. `revalidate` is off and every response is
// no-store.
//
// NOT CORS-OPEN, unlike /api/ww/positions and the embeds. This spends
// SOLANA_RPC_URL per request and takes a caller-supplied address, so it answers
// same-origin callers only and is rate limited on the same budget as the relay.
//
// THE THREE READS, and why the third one is a check rather than a lookup:
//   1. getTokenAccountsByOwner  - every token the wallet holds
//   2. getMultipleAccounts      - those mints, for their mintAuthority
//   3. getMultipleAccounts      - the authorities (battle PDAs) and the vaults
// A battle mint's authority IS its battle PDA, and a battle account carries its
// own id at offset 8. That recovers the battle id without a reverse index. The
// recovered id is then re-derived back to a mint and required to match, because
// following an arbitrary token's authority is not the same as proving the token
// is ours - see verifyMintBelongsToBattle.

import {
  battleIdFromAccount,
  battleIsSettled,
  claimablePositions,
  nonZeroHoldings,
  vaultPayableLamports,
  verifyMintBelongsToBattle,
  type BattleMint,
} from "@/lib/ww/claim";
import { TOKEN_PROGRAM_ID, vaultPda } from "@/lib/ww/pda";
import { RelayBudget, callerKey } from "@/lib/ww/rateLimit";
import { redactUrl, redactSecrets } from "@/lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RPC_SOURCE = redactUrl(RPC);

export const dynamic = "force-dynamic";
export const revalidate = 0;

const budget = new RelayBudget();

/** Base58, 32 bytes. Rejects the obvious junk before it costs an RPC call. */
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * An upper bound so one request cannot cost unbounded RPC, not a judgement
 * about who counts as a trader.
 *
 * MEASURED rather than picked: a real active WaveWarZ wallet holds **328 token
 * accounts** (captured in `ww-claimable-read.json`). The first draft of this
 * file capped at 400, which is a 22% margin over the one wallet anyone had
 * looked at - the kind of limit that works until the second wallet. With the
 * chunking above, cost is linear in accounts rather than one oversized call, so
 * the bound can be generous.
 */
const MAX_TOKEN_ACCOUNTS = 2_000;

type Json = Record<string, unknown>;

function json(status: number, body: Json) {
  return new Response(JSON.stringify({ ...body, source: RPC_SOURCE }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * `getMultipleAccounts` refuses more than 100 keys per call - "Too many inputs
 * provided; max 100". Found by running this against a real wallet that holds
 * more than that, not by reading the docs: the first version passed every unit
 * test and failed on the first wallet it was pointed at.
 *
 * Chunked rather than capped, because a wallet with 150 token accounts is a
 * normal trader, and silently answering about the first 100 of them would
 * report "nothing to claim" for a position that exists.
 */
const RPC_MAX_KEYS = 100;

async function getAccounts<T>(keys: string[], encoding: "base64" | "jsonParsed"): Promise<Array<T | null>> {
  const out: Array<T | null> = [];
  for (let i = 0; i < keys.length; i += RPC_MAX_KEYS) {
    const page = keys.slice(i, i + RPC_MAX_KEYS);
    const res = await rpc<{ value: Array<T | null> }>("getMultipleAccounts", [page, { encoding }]);
    out.push(...res.value);
  }
  return out;
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
    throw new Error(redactSecrets(`rpc ${method}: ${JSON.stringify(body.error).slice(0, 200)}`));
  }
  return body.result as T;
}

export async function GET(request: Request) {
  const decision = budget.take(callerKey(request.headers));
  if (!decision.allowed) {
    return new Response(
      JSON.stringify({ status: "error", error: decision.reason, source: RPC_SOURCE }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Retry-After": String(decision.retryAfter),
        },
      },
    );
  }

  const wallet = new URL(request.url).searchParams.get("wallet")?.trim() ?? "";
  if (!ADDRESS.test(wallet)) {
    return json(400, { status: "error", error: "wallet must be a base58 address" });
  }

  try {
    // 1. Everything the wallet holds.
    const owned = await rpc<{ value: Array<{ account: { data: { parsed: { info: {
      mint: string; tokenAmount: { amount: string };
    } } } } }> }>("getTokenAccountsByOwner", [
      wallet,
      { programId: TOKEN_PROGRAM_ID },
      { encoding: "jsonParsed" },
    ]);

    if (owned.value.length > MAX_TOKEN_ACCOUNTS) {
      return json(400, {
        status: "error",
        error: `wallet holds ${owned.value.length} token accounts, over the ${MAX_TOKEN_ACCOUNTS} this endpoint answers for`,
      });
    }

    const held = nonZeroHoldings(
      owned.value.map((a) => ({
        mint: a.account.data.parsed.info.mint,
        amount: a.account.data.parsed.info.tokenAmount.amount,
      })),
    );
    if (held.length === 0) {
      return json(200, { status: "ok", wallet, positions: [], totalPayableLamports: 0 });
    }

    // 2. Those mints, for their authorities.
    const mints = held.map((h) => h.mint);
    const mintAccounts = await getAccounts<{ data: { parsed: { info: {
      mintAuthority: string | null;
    } } } }>(mints, "jsonParsed");

    const authorityByMint = new Map<string, string>();
    mintAccounts.forEach((acct, i) => {
      const authority = acct?.data?.parsed?.info?.mintAuthority;
      if (authority) authorityByMint.set(mints[i], authority);
    });
    if (authorityByMint.size === 0) {
      return json(200, { status: "ok", wallet, positions: [], totalPayableLamports: 0 });
    }

    // 3. The candidate battle accounts, read to recover their ids.
    const authorities = [...new Set(authorityByMint.values())];
    const battleAccounts = await getAccounts<{ data: [string, string] }>(authorities, "base64");

    const battleIdByAuthority = new Map<string, number>();
    // Whether the PROGRAM has ended each battle, which is NOT the public API's
    // `winnerDecided` - see battleIsSettled. Read from the same bytes, so it
    // costs nothing extra.
    const settledByBattle = new Map<number, boolean>();
    battleAccounts.forEach((acct, i) => {
      if (!acct) return;
      const raw = new Uint8Array(Buffer.from(acct.data[0], "base64"));
      const id = battleIdFromAccount(raw);
      if (id === null) return;
      battleIdByAuthority.set(authorities[i], id);
      const settled = battleIsSettled(raw);
      if (settled !== null) settledByBattle.set(id, settled);
    });

    // Recovered, then CHECKED. A token whose authority is a real battle PDA but
    // whose mint does not re-derive from that battle is not ours, and building a
    // claim for it would aim a well-formed instruction at the wrong vault.
    const positions: Array<BattleMint & { mint: string; amount: string }> = [];
    for (const h of held) {
      const authority = authorityByMint.get(h.mint);
      if (!authority) continue;
      const battleId = battleIdByAuthority.get(authority);
      if (battleId === undefined) continue;
      const verified = verifyMintBelongsToBattle(h.mint, battleId);
      if (!verified) continue;
      positions.push({ ...verified, mint: h.mint, amount: h.amount });
    }
    if (positions.length === 0) {
      return json(200, { status: "ok", wallet, positions: [], totalPayableLamports: 0 });
    }

    // 4. The vaults. A position is only claimable if its vault holds something
    //    above the rent floor.
    const battleIds = [...new Set(positions.map((p) => p.battleId))];
    const vaults = battleIds.map((id) => vaultPda(id));
    const vaultAccounts = await getAccounts<{ lamports: number }>(vaults, "base64");

    const vaultLamportsByBattle = new Map<number, number>();
    vaultAccounts.forEach((acct, i) => {
      // A null account is unread-or-absent, and is deliberately NOT recorded as
      // zero. claimablePositions omits what it cannot see rather than calling it
      // empty.
      if (acct) vaultLamportsByBattle.set(battleIds[i], acct.lamports);
    });

    const claimable = claimablePositions(positions, vaultLamportsByBattle, settledByBattle);
    const totalPayableLamports = [...new Set(claimable.map((c) => c.battleId))].reduce(
      (sum, id) => sum + vaultPayableLamports(vaultLamportsByBattle.get(id) ?? 0),
      0,
    );

    return json(200, {
      status: "ok",
      wallet,
      readAt: new Date().toISOString(),
      positions: claimable,
      totalPayableLamports,
    });
  } catch (err) {
    return json(502, { status: "error", error: redactSecrets(String((err as Error).message)) });
  }
}
