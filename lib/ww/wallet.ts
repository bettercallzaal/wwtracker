/**
 * Talking to Phantom, without a wallet library.
 *
 * Phantom exposes two ways to sign. The common one takes a `Transaction` object
 * from `@solana/web3.js`, which would mean adding that dependency to reach a
 * method whose whole job is to hand back 64 bytes. The other is
 * `provider.request({ method: "signTransaction", params: { message } })`, where
 * `message` is the base58-encoded serialized MESSAGE - exactly what
 * `serializeMessage` already produces. So `lib/ww` stays dependency-free through
 * the signing step, which is the point of it being portable at all.
 *
 * WHAT IS VERIFIED HERE AND WHAT IS NOT - read this before trusting the module.
 *
 *   VERIFIED, against the real mainnet transaction in `lib/__fixtures__`:
 *   `assembleSignedTransaction` rebuilds that transaction's exact 765 bytes from
 *   its message and its signature. That is the step where a mistake produces a
 *   transaction the network rejects, and it is checked against bytes that
 *   actually settled.
 *
 *   NOT VERIFIED, and it cannot be from here: the shape of Phantom's `request`
 *   response, its error codes, and its event names. Those need a browser with
 *   the extension installed. They are written from Phantom's documented API and
 *   every one is marked below. A session that runs this against a real wallet
 *   for the first time should expect to correct something in `signMessage` or
 *   `mapWalletError` and should not be surprised by it.
 *
 * The split is deliberate: the unverifiable surface is kept small and named, and
 * everything that can be checked without a browser is checked.
 */
import { b58decode, b58encode } from "./pda";

/** Phantom's injected provider, narrowed to what this module uses. */
export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  isConnected?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off?(event: string, handler: (...args: unknown[]) => void): void;
}

export type WalletErrorKind =
  | "no-wallet"
  | "rejected"
  | "locked"
  | "disconnected"
  | "unknown";

export class WalletError extends Error {
  constructor(
    readonly kind: WalletErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

/**
 * Phantom's documented codes. NOT verified against a live extension - see the
 * module note. 4001 is the EIP-1193 user-rejection code, which Phantom follows.
 *
 * Anything unrecognised becomes `unknown` and KEEPS its original text rather
 * than being flattened into "something went wrong": an error nobody can read is
 * how a user ends up retrying a thing that will never work.
 */
export function mapWalletError(err: unknown): WalletError {
  if (err instanceof WalletError) return err;

  const code = (err as { code?: unknown })?.code;
  const raw = (err as { message?: unknown })?.message;
  const text = typeof raw === "string" && raw.length > 0 ? raw : String(err);

  if (code === 4001) return new WalletError("rejected", "You declined the request.", err);
  if (code === -32603 && /lock/i.test(text)) {
    return new WalletError("locked", "Your wallet is locked. Unlock it and try again.", err);
  }
  if (/user rejected|user denied/i.test(text)) {
    return new WalletError("rejected", "You declined the request.", err);
  }
  if (/locked/i.test(text)) {
    return new WalletError("locked", "Your wallet is locked. Unlock it and try again.", err);
  }
  if (/disconnect/i.test(text)) {
    return new WalletError("disconnected", "The wallet disconnected.", err);
  }
  return new WalletError("unknown", text, err);
}

/**
 * The provider, or null. Never throws and never waits: extensions inject on
 * their own schedule, so "not there yet" and "not installed" look identical for
 * the first moment of a page's life. Callers decide how long to care.
 */
export function detectPhantom(win: unknown = globalThis): PhantomProvider | null {
  const w = win as { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider };
  const provider = w?.phantom?.solana ?? w?.solana;
  return provider && provider.isPhantom ? provider : null;
}

/**
 * Assemble the wire transaction from a message and its signature.
 *
 * This is the verified part. A legacy transaction is a compact-u16 count of
 * signatures, then each 64-byte signature, then the message - and the signature
 * order must match the account order, which for every WaveWarZ trade means one
 * signature belonging to `accounts[0]`.
 *
 * Checked against the real mainnet buy: its message plus its signature rebuild
 * its exact 765 bytes.
 */
export function assembleSignedTransaction(
  messageBytes: Uint8Array,
  signatureBase58: string,
): Uint8Array {
  const signature = b58decode(signatureBase58);
  if (signature.length !== 64) {
    throw new Error(`signature is ${signature.length} bytes, expected 64`);
  }
  const out = new Uint8Array(1 + 64 + messageBytes.length);
  out[0] = 1; // one signature; compact-u16 encodes 1 as a single byte
  out.set(signature, 1);
  out.set(messageBytes, 65);
  return out;
}

export interface Connection {
  publicKey: string;
  provider: PhantomProvider;
}

/**
 * Connect. `onlyIfTrusted` asks Phantom to reconnect silently if the site is
 * already approved, which is how a returning visitor avoids a popup they did
 * not ask for - it rejects rather than prompting when the site is not trusted,
 * so the rejection is expected and is not surfaced as an error.
 */
export async function connect(
  provider: PhantomProvider,
  { onlyIfTrusted = false } = {},
): Promise<Connection | null> {
  try {
    const { publicKey } = await provider.connect({ onlyIfTrusted });
    return { publicKey: publicKey.toString(), provider };
  } catch (err) {
    if (onlyIfTrusted) return null;
    throw mapWalletError(err);
  }
}

/**
 * The bytes a wallet is asked to sign: the full transaction, with an empty
 * slot where its signature will go.
 *
 * THIS IS THE BUG OF 2026-09-21, AND IT COST A LIVE BATTLE. `signMessage` sent
 * the bare MESSAGE, which was the documented shape when this was written and
 * is not what the extension parses today. A wallet now deserializes what it is
 * given as a TRANSACTION: it reads the first byte as a compact-u16 signature
 * count, takes the next 64 bytes as a signature, and expects a message after
 * them. Handed a bare message, our first byte (numRequiredSignatures, 1) reads
 * as "one signature", the next 64 bytes of the header and account keys are
 * eaten as that signature, and the parser runs off the end - which is exactly
 * the error that came back, verbatim: "Reached end of buffer unexpectedly".
 *
 * Simulation never caught it because the relay is handed this same envelope
 * and the RPC parses it correctly; only the wallet saw the bare message.
 *
 * Same shape as `assembleSignedTransaction`, with zeros instead of a
 * signature, which is what an unsigned transaction is.
 */
export function unsignedTransaction(messageBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(1 + 64 + messageBytes.length);
  out[0] = 1; // one signature slot; compact-u16 encodes 1 as a single byte
  out.set(messageBytes, 65);
  return out;
}

/**
 * Ask the wallet to sign, and return the signature.
 *
 * Sends the unsigned TRANSACTION, base58, via the provider's `signTransaction`
 * request. Two response shapes are handled by `readSignature`: a base58
 * `signature`, and a signature as bytes. A wallet that instead returns the
 * whole signed transaction is handled too - the first 64 bytes after the count
 * are the signature, and that is what `readSignature` is given.
 */
export async function signMessage(
  provider: PhantomProvider,
  messageBytes: Uint8Array,
): Promise<string> {
  let result: unknown;
  try {
    result = await provider.request({
      method: "signTransaction",
      params: { message: b58encode(unsignedTransaction(messageBytes)) },
    });
  } catch (err) {
    throw mapWalletError(err);
  }
  return readSignature(result, messageBytes.length);
}

/**
 * Pull the signature out of whatever Phantom returned. Split out from
 * `signMessage` so it is testable without a browser, which is the only part of
 * the signing path that can be.
 */
export function readSignature(result: unknown, messageLength?: number): string {
  const r = result as {
    signature?: unknown;
    signatures?: unknown;
  };

  // A base58 signature, the simplest and documented shape.
  if (typeof r?.signature === "string" && r.signature.length > 0) return r.signature;

  // Bytes, in any of the forms that survive the trip out of an extension.
  const sig = toBytes(r?.signature);
  if (sig && sig.length === 64) return b58encode(sig);

  // THE SHAPE PHANTOM ACTUALLY RETURNED, live on 2026-09-21: the whole signed
  // transaction as an object, with `signatures` an array whose first entry is
  // the 64 bytes - and those bytes arrive as a PLAIN OBJECT with numeric keys,
  // because a Uint8Array does not survive the extension's message channel as
  // itself. `instanceof Uint8Array` was false and the signature was thrown
  // away with "wallet returned no signature", after the person had already
  // approved it in Phantom.
  if (Array.isArray(r?.signatures) && r.signatures.length > 0) {
    const first = r.signatures[0] as { signature?: unknown } | unknown;
    if (typeof (first as { signature?: unknown })?.signature === "string") {
      return (first as { signature: string }).signature;
    }
    const inner = toBytes((first as { signature?: unknown })?.signature) ?? toBytes(first);
    if (inner && inner.length === 64) return b58encode(inner);
  }

  // The whole signed transaction as bytes: one count byte, the 64 we want,
  // then the message we sent. Length-checked so an unexpected payload is not
  // chopped into a plausible-looking signature.
  const whole = toBytes(result);
  if (whole && messageLength !== undefined && whole.length === 1 + 64 + messageLength && whole[0] === 1) {
    return b58encode(whole.slice(1, 65));
  }

  if (typeof result === "string" && result.length > 0) return result;
  throw new WalletError(
    "unknown",
    `wallet returned no signature - got ${JSON.stringify(result)?.slice(0, 120)}`,
  );
}

/**
 * Bytes out of whatever a wallet handed back.
 *
 * An extension talks to the page over a message channel, and a `Uint8Array`
 * does not always arrive as one: it can come back as a plain object with
 * numeric keys, as a plain array, or as a `{type:"Buffer",data:[...]}`. A
 * reader that only knows `instanceof Uint8Array` silently fails on a
 * signature the person has already approved.
 */
function toBytes(v: unknown): Uint8Array | null {
  if (v instanceof Uint8Array) return v;
  if (ArrayBuffer.isView(v)) {
    const view = v as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(v)) {
    return v.every((n) => typeof n === "number") ? Uint8Array.from(v as number[]) : null;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.data) && o.data.every((n) => typeof n === "number")) {
      return Uint8Array.from(o.data as number[]);
    }
    // Numeric keys 0..n-1, the byte-map form.
    const keys = Object.keys(o);
    if (keys.length === 0 || !keys.every((k) => /^\d+$/.test(k))) return null;
    const out = new Uint8Array(keys.length);
    for (let i = 0; i < keys.length; i++) {
      const b = o[String(i)];
      if (typeof b !== "number" || !Number.isInteger(b) || b < 0 || b > 255) return null;
      out[i] = b;
    }
    return out;
  }
  return null;
}

/**
 * Subscribe to the events that invalidate a connection, and return an
 * unsubscribe.
 *
 * `accountChanged` matters more than it looks: Phantom lets someone switch
 * accounts while a page is open, and a page that keeps building transactions
 * for the old public key produces transactions the new account cannot sign. The
 * handler is given null when the new account is not connected to this site.
 */
export function watchWallet(
  provider: PhantomProvider,
  handlers: { onAccountChanged?: (publicKey: string | null) => void; onDisconnect?: () => void },
): () => void {
  const onAccount = (...args: unknown[]) => {
    const key = args[0] as { toString(): string } | null | undefined;
    handlers.onAccountChanged?.(key ? key.toString() : null);
  };
  const onDisconnect = () => handlers.onDisconnect?.();

  provider.on("accountChanged", onAccount);
  provider.on("disconnect", onDisconnect);

  return () => {
    provider.off?.("accountChanged", onAccount);
    provider.off?.("disconnect", onDisconnect);
  };
}
