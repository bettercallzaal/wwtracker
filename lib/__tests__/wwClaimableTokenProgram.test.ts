/**
 * A WaveWarZ position under a token program this client cannot settle must be
 * REFUSED with the reason, not silently omitted.
 *
 * WHAT WAS WRONG. `/api/ww/claimable` asked `getTokenAccountsByOwner` for the
 * classic token program only. Anything under Token-2022 was never fetched, so a
 * wallet holding such a position got `positions: []` - **the same answer as a
 * wallet holding nothing at all.** PRD 57 asks for unsupported configurations to
 * be rejected, and this lane's own rule says a filter is where an absence and a
 * mistake produce the same output. Both were being broken by one argument.
 *
 * WHY THE TOKEN-2022 CASE IS SYNTHETIC, said plainly rather than left to be
 * discovered. The WaveWarZ program mints classic SPL tokens, so no real battle
 * mint is Token-2022 today and this path cannot fire against mainnet as it
 * stands. The fixture combines a REAL derived battle mint address with the REAL
 * account shape of PYUSD, a Token-2022 mint carrying a permanent delegate, a
 * transfer hook and a transfer fee.
 *
 * That is a combination chain has never produced, and it is the right test
 * anyway: the point is that IF the program ever mints under Token-2022, or if
 * anyone points such a mint at a battle, the endpoint says so instead of
 * reporting an empty wallet. A guard for a case that cannot happen yet is how
 * this repo has already been bitten twice - by ATAs that did not exist, and by
 * a pool that could not move on a settled battle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mintFixtures from "../__fixtures__/ww-mint-accounts.json";
import claimFixture from "../__fixtures__/ww-claim-transaction.json";
import { mintPda, vaultPda, battlePda, TOKEN_PROGRAM_ID } from "../ww/pda";
import { TOKEN_2022_PROGRAM } from "../ww/tokenEligibility";
import { VAULT_RENT_FLOOR_LAMPORTS } from "../ww/claim";

const WALLET = "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk";
const BATTLE = claimFixture.battle_id;
const CLASSIC_MINT = mintPda(BATTLE, "a");
const T22_MINT = mintPda(BATTLE, "b");

const classicMintAccount = mintFixtures.mints.wavewarz_battle_mint.account;
const pyusdAccount = mintFixtures.mints.token_2022_pyusd.account;

/** A battle account whose id is BATTLE and whose settled byte is set. */
function battleAccountBase64(): string {
  const raw = new Uint8Array(300);
  new DataView(raw.buffer).setBigUint64(8, BigInt(BATTLE), true);
  raw[245] = 1;
  return Buffer.from(raw).toString("base64");
}

const tokenAccount = (mint: string, amount: string) => ({
  account: { data: { parsed: { info: { mint, tokenAmount: { amount } } } } },
});

/**
 * Stands in for the RPC. Answers by method and by which program or address was
 * asked about, so the route's real call sequence is exercised rather than a
 * rehearsed script.
 */
function mockRpc(opts: { classic: boolean; token2022: boolean }) {
  return vi.fn(async (_url: string, init: { body: string }) => {
    const { method, params } = JSON.parse(init.body);

    if (method === "getTokenAccountsByOwner") {
      const programId = params[1].programId;
      if (programId === TOKEN_PROGRAM_ID) {
        return jsonResponse({ value: opts.classic ? [tokenAccount(CLASSIC_MINT, "150000000")] : [] });
      }
      if (programId === TOKEN_2022_PROGRAM) {
        return jsonResponse({ value: opts.token2022 ? [tokenAccount(T22_MINT, "90000000")] : [] });
      }
      return jsonResponse({ value: [] });
    }

    if (method === "getMultipleAccounts") {
      const keys: string[] = params[0];
      const value = keys.map((k) => {
        if (k === CLASSIC_MINT) return classicMintAccount;
        // The synthetic pairing: a real derived battle-mint address carrying
        // PYUSD's real Token-2022 account shape, with the mint authority
        // pointed at the battle so it resolves the way a real one would.
        if (k === T22_MINT) {
          return {
            ...pyusdAccount,
            data: {
              ...pyusdAccount.data,
              parsed: {
                ...pyusdAccount.data.parsed,
                info: { ...pyusdAccount.data.parsed.info, mintAuthority: battlePda(BATTLE) },
              },
            },
          };
        }
        if (k === battlePda(BATTLE)) return { data: [battleAccountBase64(), "base64"] };
        if (k === vaultPda(BATTLE)) return { lamports: VAULT_RENT_FLOOR_LAMPORTS + 60_000_000 };
        return null;
      });
      return jsonResponse({ value });
    }
    throw new Error(`unexpected rpc method in test: ${method}`);
  });
}

const jsonResponse = (result: unknown) =>
  ({ ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result }) }) as unknown as Response;

async function callRoute() {
  const { GET } = await import("../../app/api/ww/claimable/route");
  const res = await GET(new Request(`http://localhost/api/ww/claimable?wallet=${WALLET}`));
  return res.json();
}

const realFetch = globalThis.fetch;
beforeEach(() => vi.resetModules());
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("a Token-2022 position is refused, with the reason", () => {
  it("names it, rather than returning an empty wallet", async () => {
    globalThis.fetch = mockRpc({ classic: false, token2022: true }) as unknown as typeof fetch;
    const body = await callRoute();

    expect(body.status).toBe("ok");
    expect(body.positions).toEqual([]);
    // The whole point: not silence.
    expect(body.refused).toHaveLength(1);
    expect(body.refused[0].mint).toBe(T22_MINT);
    expect(body.refused[0].battleId).toBe(BATTLE);
    expect(body.refused[0].side).toBe("b");
    expect(body.refused[0].tokenProgram).toBe(TOKEN_2022_PROGRAM);
  });

  it("gives the reason in words, and names the hazards", async () => {
    globalThis.fetch = mockRpc({ classic: false, token2022: true }) as unknown as typeof fetch;
    const body = await callRoute();

    expect(body.refused[0].reason).toMatch(/needs review/);
    expect(body.refused[0].reason).toMatch(/5 of 12 checks need data/);

    const ids = body.refused[0].failed.map((f: { id: string }) => f.id);
    expect(ids).toContain("token_program");
    expect(ids).toContain("extensions");
    const detail = JSON.stringify(body.refused[0].failed);
    expect(detail).toMatch(/permanentDelegate/);
    expect(detail).toMatch(/transferHook/);
    expect(detail).toMatch(/without their signature/);
  });

  it("reports which programs were scanned, so the filter is visible", async () => {
    globalThis.fetch = mockRpc({ classic: false, token2022: true }) as unknown as typeof fetch;
    const body = await callRoute();
    const scanned = body.scanned.map((s: { programId: string }) => s.programId);
    expect(scanned).toEqual([TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM]);
  });
});

describe("the classic path is unchanged", () => {
  /**
   * The compatibility assertion. Everything this endpoint already returned must
   * return identically; `refused` and `scanned` are additive. A wallet with only
   * classic holdings must not notice this PR.
   */
  it("returns the same positions and total as before, for a classic-only wallet", async () => {
    globalThis.fetch = mockRpc({ classic: true, token2022: false }) as unknown as typeof fetch;
    const body = await callRoute();

    expect(body.positions).toEqual([
      {
        battleId: BATTLE,
        side: "a",
        mint: CLASSIC_MINT,
        amount: "150000000",
        vaultLamports: VAULT_RENT_FLOOR_LAMPORTS + 60_000_000,
      },
    ]);
    expect(body.totalPayableLamports).toBe(60_000_000);
    expect(body.refused).toEqual([]);
  });

  it("holds both, and separates them", async () => {
    globalThis.fetch = mockRpc({ classic: true, token2022: true }) as unknown as typeof fetch;
    const body = await callRoute();

    // The classic side is claimable and unaffected by the refused one.
    expect(body.positions).toHaveLength(1);
    expect(body.positions[0].side).toBe("a");
    expect(body.totalPayableLamports).toBe(60_000_000);
    // And the Token-2022 side is named rather than dropped.
    expect(body.refused).toHaveLength(1);
    expect(body.refused[0].side).toBe("b");
  });

  it("still answers an empty wallet with an empty everything", async () => {
    globalThis.fetch = mockRpc({ classic: false, token2022: false }) as unknown as typeof fetch;
    const body = await callRoute();
    expect(body.positions).toEqual([]);
    expect(body.refused).toEqual([]);
    expect(body.totalPayableLamports).toBe(0);
    // The shape is the same whether or not anything was found, so a caller can
    // read `refused` without checking it exists first.
    expect(Array.isArray(body.scanned)).toBe(true);
  });
});
