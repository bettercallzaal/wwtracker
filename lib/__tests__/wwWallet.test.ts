/**
 * The wallet adapter. What can be checked without a browser, is.
 *
 * The load-bearing test is `assembleSignedTransaction` against the real mainnet
 * buy: its message plus its real signature must rebuild its exact 765 bytes.
 * That is the step where a mistake makes a transaction the network rejects, and
 * it is checked against bytes that actually settled rather than against this
 * module's own idea of the format.
 *
 * Phantom's live behaviour - the request/response shape, the error codes, the
 * event names - is NOT tested here and cannot be. A fake provider proves the
 * module calls what it says it calls and handles what it says it handles; it
 * cannot prove Phantom agrees. The module says so too, and the first session to
 * run this against a real extension should expect to correct something.
 */
import { describe, expect, it, vi } from "vitest";
import buyFixture from "../__fixtures__/ww-buy-transaction.json";
import messageFixture from "../__fixtures__/ww-buy-transaction-message.json";
import {
  WalletError,
  assembleSignedTransaction,
  connect,
  detectPhantom,
  mapWalletError,
  readSignature,
  signMessage,
  unsignedTransaction,
  watchWallet,
  type PhantomProvider,
} from "../ww/wallet";
import { b58decode, b58encode } from "../ww/pda";

const messageBytes = new Uint8Array(Buffer.from(messageFixture.message_base64, "base64"));

describe("assembling the signed transaction - checked against a real one", () => {
  it("rebuilds the exact bytes of the transaction that settled on chain", () => {
    const tx = assembleSignedTransaction(messageBytes, buyFixture.signature);
    // 1 byte signature count + 64 byte signature + 700 byte message.
    expect(tx.length).toBe(765);
    expect(tx[0]).toBe(1);
    expect(Buffer.from(tx.slice(1, 65)).toString("hex")).toBe(
      Buffer.from(b58decode(buyFixture.signature)).toString("hex"),
    );
    expect(Buffer.from(tx.slice(65)).toString("base64")).toBe(messageFixture.message_base64);
  });

  it("round-trips: the assembled transaction splits back into the same parts", async () => {
    const { splitTransaction } = await import("../ww/relayPolicy");
    const tx = assembleSignedTransaction(messageBytes, buyFixture.signature);
    const { signatureCount, message } = splitTransaction(tx);
    expect(signatureCount).toBe(1);
    expect(Buffer.from(message).toString("base64")).toBe(messageFixture.message_base64);
  });

  it("is accepted by the relay policy, so the whole chain fits together", async () => {
    const { decideRelay } = await import("../ww/relayPolicy");
    const { splitTransaction } = await import("../ww/relayPolicy");
    const tx = assembleSignedTransaction(messageBytes, buyFixture.signature);
    const decision = decideRelay(splitTransaction(tx).message);
    expect(decision.ok).toBe(true);
  });

  it("refuses a signature that is not 64 bytes rather than building a bad transaction", () => {
    expect(() => assembleSignedTransaction(messageBytes, b58encode(new Uint8Array(32)))).toThrow(
      /32 bytes, expected 64/,
    );
    expect(() => assembleSignedTransaction(messageBytes, "1")).toThrow(/expected 64/);
  });
});

describe("detectPhantom", () => {
  const provider = { isPhantom: true } as PhantomProvider;

  it("finds the modern window.phantom.solana and the legacy window.solana", () => {
    expect(detectPhantom({ phantom: { solana: provider } })).toBe(provider);
    expect(detectPhantom({ solana: provider })).toBe(provider);
  });

  it("prefers window.phantom.solana when both exist", () => {
    const legacy = { isPhantom: true } as PhantomProvider;
    expect(detectPhantom({ phantom: { solana: provider }, solana: legacy })).toBe(provider);
  });

  it("returns null rather than throwing when there is no wallet", () => {
    expect(detectPhantom({})).toBeNull();
    expect(detectPhantom(undefined)).toBeNull();
  });

  it("ignores another wallet that injected window.solana without isPhantom", () => {
    // A different extension claiming the same global must not be driven with
    // Phantom's request shape.
    expect(detectPhantom({ solana: { connect: () => {} } })).toBeNull();
  });
});

describe("mapWalletError", () => {
  it("reads 4001 as a rejection, which is the case users hit most", () => {
    const e = mapWalletError({ code: 4001, message: "User rejected the request." });
    expect(e.kind).toBe("rejected");
    expect(e.message).toMatch(/declined/);
  });

  it("recognises a locked wallet from text when there is no code", () => {
    expect(mapWalletError({ message: "Wallet is locked" }).kind).toBe("locked");
  });

  it("recognises a rejection from text when there is no code", () => {
    expect(mapWalletError(new Error("User denied transaction signature")).kind).toBe("rejected");
  });

  /**
   * An unrecognised error keeps its own words. Flattening everything to "something
   * went wrong" is how a user retries a thing that cannot work - the text is the
   * only part that tells them which.
   */
  it("keeps the original text for anything it does not recognise", () => {
    const e = mapWalletError(new Error("Blockhash not found"));
    expect(e.kind).toBe("unknown");
    expect(e.message).toBe("Blockhash not found");
  });

  it("passes a WalletError through unchanged rather than re-wrapping it", () => {
    const original = new WalletError("locked", "already mapped");
    expect(mapWalletError(original)).toBe(original);
  });
});

describe("readSignature", () => {
  it("takes a base58 string", () => {
    expect(readSignature({ signature: buyFixture.signature })).toBe(buyFixture.signature);
  });

  it("encodes a byte-array signature, since some builds return one", () => {
    const bytes = b58decode(buyFixture.signature);
    expect(readSignature({ signature: bytes })).toBe(buyFixture.signature);
  });

  it("accepts a bare string response", () => {
    expect(readSignature(buyFixture.signature)).toBe(buyFixture.signature);
  });

  /**
   * The important one. Returning something unusable here produces a malformed
   * transaction that fails much later, at the relay or on chain, with an error
   * that points nowhere near the wallet.
   */
  it("throws with what it actually got, rather than returning something unusable", () => {
    expect(() => readSignature({})).toThrow(/no signature/);
    expect(() => readSignature(null)).toThrow(/no signature/);
    expect(() => readSignature({ signature: "" })).toThrow(/no signature/);
    expect(() => readSignature({ publicKey: "abc" })).toThrow(/publicKey/);
  });
});

describe("connect", () => {
  const provider = (over: Partial<PhantomProvider> = {}) =>
    ({
      isPhantom: true,
      connect: vi.fn().mockResolvedValue({ publicKey: { toString: () => "PUBKEY" } }),
      disconnect: vi.fn(),
      request: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      ...over,
    }) as unknown as PhantomProvider;

  it("returns the public key as a string", async () => {
    await expect(connect(provider())).resolves.toEqual({
      publicKey: "PUBKEY",
      provider: expect.anything(),
    });
  });

  /**
   * onlyIfTrusted rejects when the site is not already approved. That is the
   * expected path for a first visit, not an error, and surfacing it would show
   * a failure to someone who did nothing wrong.
   */
  it("returns null instead of throwing when a silent reconnect is refused", async () => {
    const p = provider({ connect: vi.fn().mockRejectedValue(new Error("not trusted")) });
    await expect(connect(p, { onlyIfTrusted: true })).resolves.toBeNull();
  });

  it("throws a mapped error when an explicit connect is refused", async () => {
    const p = provider({ connect: vi.fn().mockRejectedValue({ code: 4001, message: "no" }) });
    await expect(connect(p)).rejects.toMatchObject({ kind: "rejected" });
  });
});

describe("signMessage", () => {
  /**
   * THIS TEST USED TO PIN THE BUG. It asserted the bare message was sent,
   * which is what the wallet rejected live on 2026-09-21 with "Reached end of
   * buffer unexpectedly". The contract is the unsigned TRANSACTION; the
   * message must survive inside it byte for byte.
   */
  it("sends the unsigned transaction base58-encoded, with the message intact inside it", async () => {
    const request = vi.fn().mockResolvedValue({ signature: buyFixture.signature });
    const p = { isPhantom: true, request, on: vi.fn() } as unknown as PhantomProvider;

    await expect(signMessage(p, messageBytes)).resolves.toBe(buyFixture.signature);
    expect(request).toHaveBeenCalledWith({
      method: "signTransaction",
      params: { message: b58encode(unsignedTransaction(messageBytes)) },
    });
    const sent = b58decode(request.mock.calls[0][0].params.message as string);
    expect(Buffer.from(sent.slice(65)).toString("base64")).toBe(messageFixture.message_base64);
  });

  it("maps a rejection during signing", async () => {
    const p = {
      isPhantom: true,
      request: vi.fn().mockRejectedValue({ code: 4001 }),
      on: vi.fn(),
    } as unknown as PhantomProvider;
    await expect(signMessage(p, messageBytes)).rejects.toMatchObject({ kind: "rejected" });
  });
});

describe("watchWallet", () => {
  it("subscribes to both events and unsubscribes both", () => {
    const on = vi.fn();
    const off = vi.fn();
    const p = { isPhantom: true, on, off } as unknown as PhantomProvider;

    const stop = watchWallet(p, {});
    expect(on.mock.calls.map((c) => c[0])).toEqual(["accountChanged", "disconnect"]);
    stop();
    expect(off.mock.calls.map((c) => c[0])).toEqual(["accountChanged", "disconnect"]);
  });

  /**
   * Phantom passes null when the newly-selected account is not connected to this
   * site. A handler given a stringified null would build transactions for an
   * account that cannot sign them.
   */
  it("passes null through when the new account is not connected here", () => {
    const handlers: Record<string, (...a: unknown[]) => void> = {};
    const p = {
      isPhantom: true,
      on: (e: string, h: (...a: unknown[]) => void) => (handlers[e] = h),
      off: vi.fn(),
    } as unknown as PhantomProvider;

    const seen: Array<string | null> = [];
    watchWallet(p, { onAccountChanged: (k) => seen.push(k) });

    handlers.accountChanged({ toString: () => "NEWKEY" });
    handlers.accountChanged(null);
    handlers.accountChanged(undefined);
    expect(seen).toEqual(["NEWKEY", null, null]);
  });

  it("does not throw when the provider has no off()", () => {
    const p = { isPhantom: true, on: vi.fn() } as unknown as PhantomProvider;
    expect(() => watchWallet(p, {})()).not.toThrow();
  });
});

/**
 * WHAT THE WALLET IS SENT. On 2026-09-21, live on battle 1790042941, Simulate
 * passed and Phantom answered "Reached end of buffer unexpectedly" because it
 * was handed the bare message. A wallet parses its input as a TRANSACTION, so
 * the message alone makes it read our first byte as a signature count and run
 * off the end. These pin the envelope and would have failed the old code.
 */
describe("what the wallet is asked to sign", () => {
  it("is the unsigned TRANSACTION: a count byte, 64 zero bytes, then the message", () => {
    const tx = unsignedTransaction(messageBytes);
    expect(tx.length).toBe(1 + 64 + messageBytes.length);
    expect(tx[0]).toBe(1);
    expect(Array.from(tx.slice(1, 65))).toEqual(new Array(64).fill(0));
    expect(Array.from(tx.slice(65))).toEqual(Array.from(messageBytes));
  });

  it("is the same envelope assembleSignedTransaction produces, minus the signature", () => {
    const signed = assembleSignedTransaction(messageBytes, buyFixture.signature);
    const unsigned = unsignedTransaction(messageBytes);
    expect(unsigned.length).toBe(signed.length);
    expect(Array.from(unsigned.slice(65))).toEqual(Array.from(signed.slice(65)));
  });

  it("sends that transaction to the provider, NOT the bare message", async () => {
    let sentParams: unknown = null;
    const provider = {
      request: async (args: { method: string; params?: unknown }) => {
        sentParams = args.params;
        return { signature: buyFixture.signature };
      },
    } as unknown as PhantomProvider;
    await signMessage(provider, messageBytes);
    const sent = b58decode((sentParams as { message: string }).message);
    expect(sent.length).toBe(1 + 64 + messageBytes.length);
    // The old code sent exactly messageBytes; this is the assertion that fails on it.
    expect(sent.length).not.toBe(messageBytes.length);
    expect(Array.from(sent.slice(65))).toEqual(Array.from(messageBytes));
  });

  it("reads a signature out of a whole signed transaction, when that is what comes back", () => {
    const signed = assembleSignedTransaction(messageBytes, buyFixture.signature);
    expect(readSignature(signed, messageBytes.length)).toBe(buyFixture.signature);
  });

  it("does not chop an unexpected byte array into a signature", () => {
    const wrong = new Uint8Array(1 + 64 + messageBytes.length + 3);
    wrong[0] = 1;
    expect(() => readSignature(wrong, messageBytes.length)).toThrow(/no signature/);
  });
});

/**
 * WHAT PHANTOM ACTUALLY RETURNED, live on 2026-09-21 after the person had
 * already approved the trade: the signed transaction as an object, with
 * `signatures[0]` the 64 bytes as a PLAIN OBJECT with numeric keys. A
 * Uint8Array does not survive the extension's message channel as itself, so
 * `instanceof Uint8Array` was false and a real signature was thrown away with
 * "wallet returned no signature".
 */
describe("readSignature, against shapes real wallets return", () => {
  const bytes = b58decode(buyFixture.signature);
  const byteMap = Object.fromEntries(Array.from(bytes, (b, i) => [String(i), b]));

  it("reads signatures[0] as a byte-map object, the shape that failed live", () => {
    expect(readSignature({ signatures: [byteMap] })).toBe(buyFixture.signature);
  });

  it("reads a byte-map under signature, not only a real Uint8Array", () => {
    expect(readSignature({ signature: byteMap })).toBe(buyFixture.signature);
  });

  it("reads signatures[0].signature, base58 or bytes", () => {
    expect(readSignature({ signatures: [{ signature: buyFixture.signature }] })).toBe(buyFixture.signature);
    expect(readSignature({ signatures: [{ signature: byteMap }] })).toBe(buyFixture.signature);
  });

  it("reads a node Buffer's json form and a plain number array", () => {
    expect(readSignature({ signature: { type: "Buffer", data: Array.from(bytes) } })).toBe(buyFixture.signature);
    expect(readSignature({ signature: Array.from(bytes) })).toBe(buyFixture.signature);
  });

  it("still refuses something that is not a signature", () => {
    expect(() => readSignature({ signatures: [] })).toThrow(/no signature/);
    expect(() => readSignature({ signature: { 0: 1, 2: 2 } })).toThrow(/no signature/);
    expect(() => readSignature({ signatures: [{ 0: 1, 1: 2 }] })).toThrow(/no signature/);
  });
});
