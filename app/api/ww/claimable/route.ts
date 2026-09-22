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
// callers on this origin and is rate limited on the same budget as the relay.
// "Same-origin" here means NO CORS HEADERS: another website's JavaScript
// cannot read the response, and curl or a server can, because neither needs
// CORS. There is no server-side origin check (measured 2026-09-22: the
// deployed route answered an anonymous request carrying a foreign Origin).
// That is acceptable because every byte it returns is public on chain, but it
// is a cost anyone can spend, so the rate limit is the real guard.
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
import {
  TOKEN_2022_PROGRAM,
  checkTokenEligibility,
  summariseEligibility,
  type ParsedMintAccount,
} from "@/lib/ww/tokenEligibility";
import { RelayBudget, callerKey } from "@/lib/ww/rateLimit";
import { quoteClaim } from "@/lib/ww/quote";
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
    // Same commitment as the token-account read above, so a battle settled
    // seconds ago is not "unsettled" beside a balance read from a newer slot.
    const res = await rpc<{ value: Array<T | null> }>("getMultipleAccounts", [page, { encoding, commitment: "confirmed" }]);
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
    // 1. Everything the wallet holds, under BOTH token programs.
    //
    // This used to query the classic program only, which meant a Token-2022
    // holding was not refused - it was INVISIBLE. A wallet with a position
    // under that program got `positions: []`, the same answer as a wallet with
    // nothing, and PRD 57 asks for unsupported configurations to be rejected,
    // which is the opposite of silence. It is also this lane's own rule: a
    // filter is where an absence and a mistake produce the same output.
    const byProgram = await Promise.all(
      [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM].map(async (programId) => {
        const owned = await rpc<{ value: Array<{ account: { data: { parsed: { info: {
          mint: string; tokenAmount: { amount: string };
        } } } } }> }>("getTokenAccountsByOwner", [
          wallet,
          { programId },
          // At confirmed: the claim panel polls this after a claim until the
          // burned position leaves the list, and finalized trails confirmed
          // by about 13 s of its 15 s budget. Audit 2026-09-22.
          { encoding: "jsonParsed", commitment: "confirmed" },
        ]);
        return { programId, accounts: owned.value };
      }),
    );

    const totalAccounts = byProgram.reduce((n, p) => n + p.accounts.length, 0);
    if (totalAccounts > MAX_TOKEN_ACCOUNTS) {
      return json(400, {
        status: "error",
        error: `wallet holds ${totalAccounts} token accounts, over the ${MAX_TOKEN_ACCOUNTS} this endpoint answers for`,
      });
    }

    const held = byProgram.flatMap((p) =>
      nonZeroHoldings(
        p.accounts.map((a) => ({
          mint: a.account.data.parsed.info.mint,
          amount: a.account.data.parsed.info.tokenAmount.amount,
        })),
      ),
    );
    const scanned = byProgram.map((p) => ({ programId: p.programId, accounts: p.accounts.length }));
    if (held.length === 0) {
      return json(200, {
        status: "ok", wallet, positions: [], refused: [], scanned, totalPayableLamports: 0,
      });
    }

    // 2. Those mints, for their authorities.
    const mints = held.map((h) => h.mint);
    const mintAccounts = await getAccounts<ParsedMintAccount>(mints, "jsonParsed");

    const authorityByMint = new Map<string, string>();
    // The whole account is kept, not just the authority: the eligibility check
    // needs the owning program, decimals and extensions, and they come from
    // this same read rather than a second one.
    const accountByMint = new Map<string, ParsedMintAccount>();
    mintAccounts.forEach((acct, i) => {
      if (acct) accountByMint.set(mints[i], acct);
      const authority = acct?.data?.parsed?.info?.mintAuthority;
      if (authority) authorityByMint.set(mints[i], authority);
    });
    if (authorityByMint.size === 0) {
      return json(200, {
        status: "ok", wallet, positions: [], refused: [], scanned, totalPayableLamports: 0,
      });
    }

    // 3. The candidate battle accounts, read to recover their ids.
    const authorities = [...new Set(authorityByMint.values())];
    const battleAccounts = await getAccounts<{ data: [string, string] }>(authorities, "base64");

    const battleIdByAuthority = new Map<string, number>();
    // Whether the PROGRAM has ended each battle, which is NOT the public API's
    // `winnerDecided` - see battleIsSettled. Read from the same bytes, so it
    // costs nothing extra.
    const settledByBattle = new Map<number, boolean>();
    // The settlement inputs, from the same bytes: pools at 212/220, supplies
    // at 196/204, the market winner at 244. With those, quoteClaim gives the
    // wallet's own payout to the lamport (15 of 15 real claims, #340), which
    // is what a person needs to see before signing. The panel used to show the
    // vault total with a note that it was not their share.
    const settlementByBattle = new Map<number, { poolA: number; poolB: number; supplyA: number; supplyB: number; winnerArtistA: boolean }>();
    battleAccounts.forEach((acct, i) => {
      if (!acct) return;
      const raw = new Uint8Array(Buffer.from(acct.data[0], "base64"));
      const id = battleIdFromAccount(raw);
      if (id === null) return;
      battleIdByAuthority.set(authorities[i], id);
      const settled = battleIsSettled(raw);
      if (settled !== null) settledByBattle.set(id, settled);
      if (raw.length >= 246) {
        const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        settlementByBattle.set(id, {
          poolA: Number(dv.getBigUint64(212, true)),
          poolB: Number(dv.getBigUint64(220, true)),
          supplyA: Number(dv.getBigUint64(196, true)),
          supplyB: Number(dv.getBigUint64(204, true)),
          winnerArtistA: raw[244] !== 0,
        });
      }
    });

    // Recovered, then CHECKED. A token whose authority is a real battle PDA but
    // whose mint does not re-derive from that battle is not ours, and building a
    // claim for it would aim a well-formed instruction at the wrong vault.
    const positions: Array<BattleMint & { mint: string; amount: string }> = [];
    /**
     * A holding that IS a WaveWarZ position but sits under a token program this
     * client cannot settle. Reported rather than dropped: the person owns it,
     * and "we found nothing" would be a lie about their wallet.
     */
    const refused: Array<{
      mint: string; battleId: number; side: "a" | "b"; amount: string;
      tokenProgram: string | null; reason: string;
      failed: Array<{ id: string; detail: string }>;
    }> = [];

    for (const h of held) {
      const authority = authorityByMint.get(h.mint);
      if (!authority) continue;
      const battleId = battleIdByAuthority.get(authority);
      if (battleId === undefined) continue;
      const verified = verifyMintBelongsToBattle(h.mint, battleId);
      if (!verified) continue;

      // It is ours. Now: can this client settle it?
      const account = accountByMint.get(h.mint) ?? null;
      const owner = account?.owner ?? null;
      if (owner !== TOKEN_PROGRAM_ID) {
        const eligibility = checkTokenEligibility(h.mint, account);
        refused.push({
          mint: h.mint,
          battleId,
          side: verified.side,
          amount: h.amount,
          tokenProgram: owner,
          reason: summariseEligibility(eligibility),
          failed: eligibility.checks
            .filter((c) => c.verdict === "fail" || c.verdict === "review")
            .map((c) => ({ id: c.id, detail: c.detail })),
        });
        continue;
      }
      positions.push({ ...verified, mint: h.mint, amount: h.amount });
    }
    if (positions.length === 0) {
      return json(200, {
        status: "ok", wallet, positions: [], refused, scanned, totalPayableLamports: 0,
      });
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

    const claimable = claimablePositions(positions, vaultLamportsByBattle, settledByBattle).map((p) => {
      const st = settlementByBattle.get(p.battleId);
      if (!st) return { ...p, claimLamports: null, won: null };
      const won = st.winnerArtistA ? p.side === "a" : p.side === "b";
      const sideSupply = p.side === "a" ? st.supplyA : st.supplyB;
      const sidePool = p.side === "a" ? st.poolA : st.poolB;
      const otherPool = p.side === "a" ? st.poolB : st.poolA;
      const balance = Number(p.amount);
      // A balance above the side's supply cannot happen on chain; if the read
      // says so, report no figure rather than a wrong one.
      if (!Number.isFinite(balance) || sideSupply <= 0 || balance > sideSupply) return { ...p, claimLamports: null, won };
      return { ...p, claimLamports: quoteClaim({ balance, sideSupply, sidePool, otherPool, won }).lamportsOut, won };
    });
    const totalClaimLamports = claimable.reduce((sum, p) => sum + (p.claimLamports ?? 0), 0);
    const totalPayableLamports = [...new Set(claimable.map((c) => c.battleId))].reduce(
      (sum, id) => sum + vaultPayableLamports(vaultLamportsByBattle.get(id) ?? 0),
      0,
    );

    return json(200, {
      status: "ok",
      wallet,
      readAt: new Date().toISOString(),
      positions: claimable,
      // Always present, empty when nothing was refused, so a caller can rely on
      // the shape rather than on the happy path.
      refused,
      scanned,
      totalPayableLamports,
      // What THIS wallet is owed, summed from per-position quoteClaim; null
      // figures are skipped, not counted as zero.
      totalClaimLamports,
    });
  } catch (err) {
    return json(502, { status: "error", error: redactSecrets(String((err as Error).message)) });
  }
}
