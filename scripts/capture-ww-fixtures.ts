#!/usr/bin/env tsx
/**
 * Re-capture the four transaction fixtures from chain, or check that the
 * committed ones still reproduce.
 *
 *   npx tsx scripts/capture-ww-fixtures.ts --check    # re-fetch and compare, exit 1 on any drift
 *   npx tsx scripts/capture-ww-fixtures.ts --write    # overwrite the committed fixtures
 *   npx tsx scripts/capture-ww-fixtures.ts --out DIR  # write them somewhere else
 *
 * WHY THIS EXISTS. `lib/__fixtures__/ww-buy-transaction.json` and
 * `ww-buy-transaction-message.json` are what the whole `lib/ww` suite is checked
 * against, and they were produced by a session that decoded a transaction by
 * hand and pasted the result. The data is real and a reviewer verified it against
 * the raw bytes, but until now nothing in the repo could re-derive it, so the
 * fixtures were trusted rather than reproducible - the same shape as a figure
 * whose inputs were never committed.
 *
 * WHAT `--check` PROVES, AND WHAT IT DOES NOT. It proves the fixtures are
 * re-derivable: the transaction still reads from chain the way it was recorded,
 * and nothing drifted when they were transcribed. It does NOT independently prove
 * the byte layout is interpreted correctly, because this script and the library
 * share `b58decode`. That was established separately, by a reviewer decoding the
 * instruction from scratch in Python against the Solana wire spec. Two different
 * claims; this one is about reproducibility.
 *
 * The message fixture is the stronger half: its bytes come from `getTransaction`
 * with base64 encoding and are compared after a Node `Buffer` round trip, so no
 * code of ours touches them at all.
 *
 * THE THIRD FIXTURE, `ww-ata-create-transaction.json`, exists because the other
 * two cannot show what they do not contain. Their trader had already traded that
 * battle, so his token accounts existed and his transaction has no account
 * creation in it - and a first-time trader's does. It pins the six accounts and
 * their order for an associated-token-account creation, read off a real
 * transaction rather than recalled from a spec.
 *
 * THE FOURTH, `ww-ata-create-idempotent.json`, is the only fixture here that is
 * not a WaveWarZ transaction, and it earns its place by pinning one byte.
 * `createAssociatedTokenAccountIdempotentInstruction` emits `0x01`, and until
 * this fixture existed nothing in the repo established that `0x01` IS
 * CreateIdempotent in the deployed program - it matched the published SPL enum,
 * which is a memory of a document rather than a measurement, and this repo's bar
 * is higher than that everywhere else. No WaveWarZ trader has used the idempotent
 * variant, so the example has to come from elsewhere on mainnet. What makes it
 * evidence is that the VALIDATOR names the instruction: `jsonParsed` reports
 * `"type": "createIdempotent"` for these bytes, and that decoder is neither ours
 * nor the document we were recalling.
 *
 * COST. Six RPC calls - five `getTransaction`, one `getAccountInfo`. That is
 * deliberate: `SOLANA_RPC_URL` is a keyed endpoint shared with the production
 * /live page, and an unthrottled scan against it has taken that page down before
 * (see lib/redact.ts). Six calls need no throttle; do not grow this into a loop
 * over battles without one.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { b58decode } from "../lib/ww/pda";
import { redactUrl } from "../lib/redact";

const FIXTURES = join(process.cwd(), "lib", "__fixtures__");
const BUY = "ww-buy-transaction.json";
const MESSAGE = "ww-buy-transaction-message.json";
const ATA = "ww-ata-create-transaction.json";
const IDEMPOTENT = "ww-ata-create-idempotent.json";

const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function arg(name: string): string | true | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} from ${redactUrl(RPC)}`);
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  if (body.result === null || body.result === undefined) {
    throw new Error(`${method}: no result - the transaction may have aged out of this node`);
  }
  return body.result;
}

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

/**
 * Rebuild both fixtures from the signature the committed ones name. Their own
 * `signature` is the input, so this re-derives everything else: if a field drifts,
 * `--check` names it rather than quietly rewriting it.
 */
async function capture(signature: string, battleId: number) {
  const json = await rpc("getTransaction", [
    signature,
    { encoding: "json", maxSupportedTransactionVersion: 0 },
  ]);
  const keys: string[] = json.transaction.message.accountKeys;
  const programIndexOf = (ix: any) => keys[ix.programIdIndex];

  const { PROGRAM_ID } = await import("../lib/ww/pda");
  const ours = json.transaction.message.instructions.filter(
    (ix: any) => programIndexOf(ix) === PROGRAM_ID,
  );
  if (ours.length !== 1) {
    throw new Error(`expected exactly one WaveWarZ instruction, found ${ours.length}`);
  }
  const ix = ours[0];
  const data = b58decode(ix.data);

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decodedArgs = {
    amount_lamports: Number(view.getBigUint64(8, true)),
    artist_a: data[16] === 1,
    min_tokens_out: Number(view.getBigUint64(17, true)),
    deadline: Number(view.getBigInt64(25, true)),
  };

  const battlePdaFromChain = keys[ix.accounts[0]];
  const account = await rpc("getAccountInfo", [
    battlePdaFromChain,
    { encoding: "base64" },
  ]);

  // The whole message, exactly as it settled. base64 in, base64 out - no code of
  // ours between chain and the fixture.
  const base64Tx = (
    await rpc("getTransaction", [
      signature,
      { encoding: "base64", maxSupportedTransactionVersion: 0 },
    ])
  ).transaction[0];
  const rawTx = Buffer.from(base64Tx, "base64");
  const numSignatures = rawTx[0];
  const message = rawTx.subarray(1 + 64 * numSignatures);

  const buy = {
    _what:
      "One real mainnet buyShares transaction, and the raw battle account it traded against. The fixture for lib/ww/instructions.ts: the builder must reproduce these bytes and these accounts exactly.",
    _source: `Captured by scripts/capture-ww-fixtures.ts. Re-derivable with --check. All of it is public chain data.`,
    battle_id: battleId,
    signature,
    slot: json.slot,
    block_time: json.blockTime,
    program_id: PROGRAM_ID,
    instruction_data_hex: hex(data),
    decoded_args: decodedArgs,
    accounts_in_order: ix.accounts.map((i: number) => keys[i]),
    battle_account_base64: account.value.data[0],
  };

  const msg = {
    _what:
      "The serialized legacy message of the same real mainnet buy as ww-buy-transaction.json. The round-trip control for lib/ww/message.ts: parse then re-serialize must be byte-identical.",
    _note:
      "Only instruction 2 of its 6 is ours. 0 and 1 are ComputeBudget (200,000 unit limit, 375,000 micro-lamport price); 3, 4 and 5 are Lighthouse (L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95), the guard program Phantom injects when it signs. A client does not build those.",
    signature,
    slot: json.slot,
    message_base64: message.toString("base64"),
    expected: {
      num_signatures: numSignatures,
      num_readonly_signed: message[1],
      num_readonly_unsigned: message[2],
      num_accounts: keys.length,
      num_instructions: json.transaction.message.instructions.length,
      payer: keys[0],
      recent_blockhash: json.transaction.message.recentBlockhash,
      our_instruction_index: json.transaction.message.instructions.indexOf(ix),
      compute_unit_limit: 200000,
      compute_unit_price_micro_lamports: 375000,
    },
  };

  return { buy, msg };
}

/**
 * A real first-time trade: the transaction that creates a trader's two token
 * accounts and then buys with them.
 *
 * Only the ATA instructions are recorded. The buy in the same transaction is not
 * re-derived here - `ww-buy-transaction.json` already does that job, and two
 * fixtures asserting the same thing drift apart rather than agreeing twice.
 */
async function captureAta(signature: string, battleId: number) {
  const json = await rpc("getTransaction", [
    signature,
    { encoding: "json", maxSupportedTransactionVersion: 0 },
  ]);
  const keys: string[] = json.transaction.message.accountKeys;
  const instructions = json.transaction.message.instructions;

  const ataIxs = instructions.filter(
    (ix: any) => keys[ix.programIdIndex] === ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  if (ataIxs.length !== 2) {
    throw new Error(
      `expected two ATA instructions in ${signature.slice(0, 12)}, found ${ataIxs.length}`,
    );
  }

  return {
    _what:
      "A real mainnet transaction from a trader's FIRST trade in a battle: it creates both of the trader's associated token accounts, then buys. The fixture for createAssociatedTokenAccountIdempotentInstruction - the six accounts and their order must match.",
    _note:
      "The chain instructions are plain Create, whose data field is empty. The builder emits CreateIdempotent, whose data is the single byte 0x01. That difference is deliberate and is asserted rather than glossed: see the comment on the builder. Everything else - the six accounts, in this order - is identical.",
    _source:
      "Captured by scripts/capture-ww-fixtures.ts. Re-derivable with --check. All of it is public chain data.",
    battle_id: battleId,
    signature,
    slot: json.slot,
    fee_payer: keys[0],
    ata_instructions: ataIxs.map((ix: any) => ({
      program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
      data_hex: hex(b58decode(ix.data)),
      accounts_in_order: ix.accounts.map((i: number) => keys[i]),
    })),
    // The ordering claim: creation comes before the trade, in the same
    // transaction. A client that appends instead would fail on its own accounts.
    ata_instruction_indexes: ataIxs.map((ix: any) => instructions.indexOf(ix)),
    wavewarz_instruction_index: instructions.findIndex(
      (ix: any) => keys[ix.programIdIndex] === "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo",
    ),
  };
}

/**
 * A real `CreateIdempotent` on mainnet, captured twice over: once raw, for the
 * data byte, and once through the validator's own parser, for the NAME of that
 * byte.
 *
 * The second half is the part that matters. Anyone can read `0x01` off a
 * transaction; what nothing offline could establish is that `0x01` means
 * CreateIdempotent to the deployed program. `jsonParsed` is decoded by the
 * validator, so recording its verdict alongside the byte turns a recalled enum
 * value into an observation. It is still a decoder rather than the program
 * itself - the program's own acceptance was established separately, by
 * simulating a transaction carrying this byte and watching it create an account
 * and then decline to revert when the account already existed.
 */
async function captureIdempotent(signature: string) {
  const parsed = await rpc("getTransaction", [
    signature,
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
  ]);
  const raw = await rpc("getTransaction", [
    signature,
    { encoding: "json", maxSupportedTransactionVersion: 0 },
  ]);

  const parsedIxs = parsed.transaction.message.instructions.filter(
    (ix: any) => ix.programId === ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const idempotent = parsedIxs.filter((ix: any) => ix.parsed?.type === "createIdempotent");
  if (idempotent.length === 0) {
    throw new Error(
      `${signature.slice(0, 12)} has no createIdempotent instruction - it has ` +
        `[${parsedIxs.map((ix: any) => ix.parsed?.type ?? "unparsed").join(", ")}]`,
    );
  }

  const keys: string[] = raw.transaction.message.accountKeys;
  const rawIxs = raw.transaction.message.instructions.filter(
    (ix: any) => keys[ix.programIdIndex] === ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  if (rawIxs.length !== parsedIxs.length) {
    throw new Error("the parsed and raw views disagree about how many ATA instructions there are");
  }
  // Pair them by position: same transaction, same order, two encodings.
  const first = idempotent[0];
  const rawFirst = rawIxs[parsedIxs.indexOf(first)];

  return {
    _what:
      "A real mainnet CreateIdempotent instruction from the SPL associated token account program. Not a WaveWarZ transaction: no WaveWarZ trader has used the idempotent variant, and this fixture exists only to pin its one-byte discriminator to something observed.",
    _note:
      "instruction_name is the VALIDATOR's decoding of data_hex, via jsonParsed. That is what makes 0x01 evidence rather than a remembered enum value: the decoder is neither ours nor the SPL document. The deployed program's own acceptance of the byte was established separately, by simulation.",
    _source:
      "Captured by scripts/capture-ww-fixtures.ts. Re-derivable with --check. All of it is public chain data.",
    signature,
    slot: raw.slot,
    program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
    instruction_name: first.parsed.type,
    data_hex: hex(b58decode(rawFirst.data)),
    accounts_in_order: rawFirst.accounts.map((i: number) => keys[i]),
    // Named so a reader can see the six roles without decoding base58 by eye.
    parsed_info: first.parsed.info,
  };
}

/** Compare field by field so a failure names what drifted, not just that it did. */
function compare(label: string, got: any, want: any): string[] {
  const problems: string[] = [];
  const walk = (path: string, a: any, b: any) => {
    if (path.startsWith("_")) return; // prose, not data
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    // Arrays element by element: "accounts_in_order[7]" locates a swap; dumping
    // two thirteen-element lists and leaving the reader to spot it does not.
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        problems.push(
          `${label}.${path}: chain has ${a.length} entries, fixture has ${b.length}`,
        );
      }
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        walk(`${path}[${i}]`, a[i], b[i]);
      }
      return;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        walk(path ? `${path}.${k}` : k, a[k], b[k]);
      }
      return;
    }
    const show = (v: any) => {
      const s = JSON.stringify(v);
      return s && s.length > 90 ? `${s.slice(0, 80)}... (${s.length} chars)` : s;
    };
    problems.push(`${label}.${path}: chain says ${show(a)}, fixture says ${show(b)}`);
  };
  for (const k of new Set([...Object.keys(got), ...Object.keys(want)])) {
    walk(k, got[k], want[k]);
  }
  return problems;
}

async function main() {
  const committedBuy = JSON.parse(readFileSync(join(FIXTURES, BUY), "utf8"));
  const committedMsg = JSON.parse(readFileSync(join(FIXTURES, MESSAGE), "utf8"));

  if (committedBuy.signature !== committedMsg.signature) {
    throw new Error("the two fixtures name different transactions");
  }

  const committedAta = JSON.parse(readFileSync(join(FIXTURES, ATA), "utf8"));
  const committedIdem = JSON.parse(readFileSync(join(FIXTURES, IDEMPOTENT), "utf8"));

  console.error(`capturing ${committedBuy.signature.slice(0, 12)}... from ${redactUrl(RPC)}`);
  const { buy, msg } = await capture(committedBuy.signature, committedBuy.battle_id);
  console.error(`capturing ${committedAta.signature.slice(0, 12)}...`);
  const ata = await captureAta(committedAta.signature, committedAta.battle_id);
  console.error(`capturing ${committedIdem.signature.slice(0, 12)}...`);
  const idem = await captureIdempotent(committedIdem.signature);

  if (arg("--check")) {
    const problems = [
      ...compare(BUY, buy, committedBuy),
      ...compare(MESSAGE, msg, committedMsg),
      ...compare(ATA, ata, committedAta),
      ...compare(IDEMPOTENT, idem, committedIdem),
    ];
    if (problems.length === 0) {
      console.log(
        `all four fixtures reproduce exactly: ${buy.accounts_in_order.length} accounts, ` +
          `${buy.instruction_data_hex.length / 2} instruction bytes, ` +
          `${Buffer.from(msg.message_base64, "base64").length} message bytes, ` +
          `${ata.ata_instructions.length} ATA instructions, ` +
          `and ${idem.instruction_name} = 0x${idem.data_hex}`,
      );
      process.exit(0);
    }
    console.error(`${problems.length} field(s) do not reproduce:`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

  const out = typeof arg("--out") === "string" ? (arg("--out") as string) : null;
  if (!out && !arg("--write")) {
    console.error("refusing to write: pass --check, or --out DIR, or --write to overwrite the committed fixtures");
    process.exit(2);
  }
  const dir = out ?? FIXTURES;
  writeFileSync(join(dir, BUY), JSON.stringify(buy, null, 1) + "\n");
  writeFileSync(join(dir, MESSAGE), JSON.stringify(msg, null, 1) + "\n");
  writeFileSync(join(dir, ATA), JSON.stringify(ata, null, 1) + "\n");
  writeFileSync(join(dir, IDEMPOTENT), JSON.stringify(idem, null, 1) + "\n");
  console.error(`wrote ${BUY}, ${MESSAGE}, ${ATA} and ${IDEMPOTENT} to ${dir}`);
}

main().catch((e) => {
  console.error(`FAILED: ${e.message}`);
  process.exit(1);
});
