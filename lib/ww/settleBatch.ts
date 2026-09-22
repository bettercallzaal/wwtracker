/**
 * Settling 82 battles should not be 82 signatures.
 *
 * endBattle is one instruction with seven accounts, five of them unique per
 * battle (the battle PDA, its vault, and the two artists plus the platform
 * wallet, which repeat: 82 battles named only 39 distinct wallets on
 * 2026-09-22). So several settles fit in one legacy transaction and cost one
 * approval.
 *
 * WHAT BINDS IS THE PACKET, NOT COMPUTE. Measured 2026-09-22 against the real
 * unsettled list: eight settles serialize to 1,162 bytes of the 1,232-byte
 * limit and simulate at 136,746 compute units of the 1,400,000 available. Nine
 * would be 1,244 bytes. So the packer measures the real serialized message and
 * stops before the limit rather than assuming a fixed count: batches came out
 * at 8, but a battle whose artists are new to the batch costs more keys, and a
 * fixed 8 would eventually build a transaction the network drops.
 *
 * ONE FAILURE FAILS THE WHOLE BATCH, which is why the caller simulates each
 * batch before signing it: if somebody else settles one of these between the
 * scan and the signature, the batch would fail and the page re-reads and
 * repacks rather than sending it.
 */

/** The packet limit for a legacy transaction, including its signatures. */
export const TRANSACTION_PACKET_BYTES = 1232;
/** One signature: the compact-u16 count byte plus 64 bytes. endBattle adds no signer. */
export const SIGNATURE_BYTES = 65;
/** Measured 17,094 units per settle in a batch of eight; this is the headroom figure. */
export const UNITS_PER_SETTLE = 25_000;
/** The compute budget instructions themselves, plus slack. */
export const UNITS_OVERHEAD = 10_000;
/** A single transaction cannot ask for more than this. */
export const MAX_UNITS = 1_400_000;

export interface SettleBatch<T> {
  items: T[];
  /** The serialized message length the packer measured for these items. */
  messageBytes: number;
  /** What the caller should ask for as a compute limit. */
  unitLimit: number;
}

/**
 * Greedily pack items into transactions that fit.
 *
 * `messageLength` serializes a candidate batch and returns its byte length;
 * it is injected so the packer stays pure and the tests do not need a
 * blockhash. Order is preserved: the caller decides what goes first, and on
 * 2026-09-22 that is the battles that still hold money.
 *
 * An item that does not fit alone is returned as its own batch anyway, with
 * its real size, rather than dropped. A dropped battle is a battle nobody
 * settles and nobody is told about; an oversized batch fails loudly.
 */
export function packSettleBatches<T>(
  items: T[],
  messageLength: (batch: T[]) => number,
  opts: { packetBytes?: number; maxUnits?: number; unitsPerSettle?: number } = {},
): Array<SettleBatch<T>> {
  const packet = opts.packetBytes ?? TRANSACTION_PACKET_BYTES;
  const maxUnits = opts.maxUnits ?? MAX_UNITS;
  const perSettle = opts.unitsPerSettle ?? UNITS_PER_SETTLE;
  const batches: Array<SettleBatch<T>> = [];
  let current: T[] = [];
  let currentBytes = 0;

  const flush = () => {
    if (current.length === 0) return;
    batches.push({ items: current, messageBytes: currentBytes, unitLimit: unitLimitFor(current.length, perSettle) });
    current = [];
    currentBytes = 0;
  };

  for (const item of items) {
    const candidate = [...current, item];
    const bytes = SIGNATURE_BYTES + messageLength(candidate);
    const units = unitLimitFor(candidate.length, perSettle);
    if (current.length > 0 && (bytes > packet || units > maxUnits)) {
      flush();
      const alone = SIGNATURE_BYTES + messageLength([item]);
      current = [item];
      currentBytes = alone;
      continue;
    }
    current = candidate;
    currentBytes = bytes;
  }
  flush();
  return batches;
}

export function unitLimitFor(count: number, perSettle = UNITS_PER_SETTLE): number {
  return count * perSettle + UNITS_OVERHEAD;
}

/** "11 signatures for 82 battles" - what the page tells somebody before they start. */
export function describeBatches(batches: Array<SettleBatch<unknown>>): string {
  const total = batches.reduce((n, b) => n + b.items.length, 0);
  if (total === 0) return "Nothing to settle.";
  const sizes = batches.map((b) => b.items.length);
  const min = Math.min(...sizes), max = Math.max(...sizes);
  const per = min === max ? `${min} each` : `${min} to ${max} each`;
  return `${total} battles in ${batches.length} transaction${batches.length === 1 ? "" : "s"} (${per}), so ${batches.length} approval${batches.length === 1 ? "" : "s"} rather than ${total}.`;
}
