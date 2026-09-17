// GET /api/ww/battle-account?battleId=123
//
// The raw Battle account, base64, plus the two pool figures decoded from it.
//
// WHY THE RAW BYTES AND NOT A DECODED OBJECT. The trading widget needs three
// wallets that live at fixed offsets - artistA at 36, artistB at 68 and the fee
// destination at 100 - and they go straight into an instruction's account list.
// Handing back the bytes lets `battleAccountsFromRaw` read them with the same
// code that is tested against a real mainnet transaction, rather than trusting
// this route to re-describe a layout correctly. One decoder, checked once.
//
// The pools are decoded here as a convenience for the quote, which needs a
// number rather than a buffer. They are the same offsets `decodeBattle` uses.
//
// Same-origin only, like /api/ww/trade and unlike the rest of /api/ww/*: this
// spends the keyed RPC on request. It is a read, so it is cheaper to abuse than
// the relay, but it is not free.

import { battlePda } from "@/lib/ww/pda";
import { redactSecrets, redactUrl } from "@/lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const RPC_SOURCE = redactUrl(RPC);

export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify({ ...body, source: RPC_SOURCE }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const battleId = new URL(request.url).searchParams.get("battleId");
  if (!battleId || !/^\d{9,12}$/.test(battleId)) {
    return json(400, { status: "error", error: "battleId must be a 9 to 12 digit number" });
  }

  const pda = battlePda(Number(battleId));
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getAccountInfo",
        params: [pda, { encoding: "base64" }],
      }),
      cache: "no-store",
    });
    if (!res.ok) return json(502, { status: "error", error: `rpc HTTP ${res.status}` });
    const body = await res.json();
    if (body.error) {
      return json(502, { status: "error", error: redactSecrets(JSON.stringify(body.error).slice(0, 200)) });
    }

    // A derived address always looks valid, so a battle that does not exist
    // returns null here rather than an error. Saying "not found" is the only
    // honest answer; a zero-filled account would read as a battle with no trades.
    if (!body.result?.value) {
      return json(404, { status: "not-found", error: `no Battle account at ${pda}`, pda });
    }

    const raw = Buffer.from(body.result.value.data[0], "base64");
    if (raw.length < 353) {
      return json(502, { status: "error", error: `account is ${raw.length} bytes, expected 353` });
    }
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);

    return json(200, {
      status: "ok",
      pda,
      account: body.result.value.data[0],
      // Offsets from chain/BATTLE-ACCOUNT.md, the same ones lib/battlePositions
      // decodes. Lamports, not SOL - the quote works in lamports and converting
      // twice is how a rounding error gets in.
      poolALamports: Number(dv.getBigUint64(228, true)),
      poolBLamports: Number(dv.getBigUint64(236, true)),
      endTime: Number(dv.getBigInt64(28, true)),
      settled: raw[245] !== 0,
    });
  } catch (err) {
    return json(502, { status: "error", error: redactSecrets((err as Error).message) });
  }
}
