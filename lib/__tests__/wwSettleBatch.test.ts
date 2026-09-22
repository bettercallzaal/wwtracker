/**
 * The packer that turns 82 settles into 11 approvals.
 *
 * The numbers here are the measured ones: on 2026-09-22 the real unsettled
 * list packed to eight settles at 1,162 bytes, and nine would have been 1,244,
 * over the 1,232-byte packet limit. The fake `messageLength` below reproduces
 * that shape (a fixed header plus a per-item cost) so the packing rule is
 * tested without a blockhash or a network.
 */
import { describe, expect, it } from "vitest";
import {
  describeBatches,
  packSettleBatches,
  SIGNATURE_BYTES,
  TRANSACTION_PACKET_BYTES,
  unitLimitFor,
} from "../ww/settleBatch";

/**
 * THE REAL CURVE, not a smooth one. These are the transaction sizes measured
 * on 2026-09-22 against the live unsettled list, in bytes including the
 * signature: one settle is 460, and eight is 1,162, but the steps are 146 and
 * 82 alternating rather than constant, because a battle whose artists are
 * already named in the batch costs two keys and a battle bringing new ones
 * costs four. That unevenness is the reason the packer measures instead of
 * counting to a fixed number.
 */
const MEASURED_TOTAL = [0, 460, 606, 688, 834, 916, 998, 1080, 1162, 1244];
const measured = (batch: unknown[]) => {
  const n = batch.length;
  if (n === 0) return 0;
  const total = n < MEASURED_TOTAL.length ? MEASURED_TOTAL[n] : MEASURED_TOTAL[9] + (n - 9) * 82;
  return total - SIGNATURE_BYTES;
};

describe("packSettleBatches", () => {
  it("packs to eight per transaction on the measured size curve, and never over the packet", () => {
    const items = Array.from({ length: 82 }, (_, i) => i);
    const batches = packSettleBatches(items, measured);
    expect(batches.every((b) => b.messageBytes <= TRANSACTION_PACKET_BYTES)).toBe(true);
    expect(batches[0].items.length).toBe(8);
    expect(batches.length).toBe(11);
  });

  it("settles every battle exactly once, in the order it was given", () => {
    const items = Array.from({ length: 82 }, (_, i) => i);
    const flat = packSettleBatches(items, measured).flatMap((b) => b.items);
    expect(flat).toEqual(items);
    expect(new Set(flat).size).toBe(82);
  });

  it("asks for a compute limit that scales with the batch", () => {
    const batches = packSettleBatches([1, 2, 3], measured);
    expect(batches[0].unitLimit).toBe(unitLimitFor(3));
    expect(unitLimitFor(8)).toBeGreaterThan(136_746); // the measured cost of a real batch of eight
  });

  it("splits on the compute ceiling when that binds before the packet", () => {
    const tiny = (b: unknown[]) => 100 + b.length; // never near the packet
    const batches = packSettleBatches(Array.from({ length: 10 }, (_, i) => i), tiny, { maxUnits: 60_000, unitsPerSettle: 25_000 });
    expect(batches.every((b) => b.unitLimit <= 60_000)).toBe(true);
    expect(batches[0].items.length).toBe(2);
  });

  /**
   * A battle that cannot fit alone must still be returned, with its real size.
   * Dropping it would leave a battle nobody settles and nobody is told about.
   */
  it("returns an oversized item as its own batch rather than dropping it", () => {
    const huge = (b: unknown[]) => b.length * 5_000;
    const batches = packSettleBatches([1, 2], huge);
    expect(batches.length).toBe(2);
    expect(batches.flatMap((b) => b.items)).toEqual([1, 2]);
    expect(batches[0].messageBytes).toBe(SIGNATURE_BYTES + 5_000);
  });

  it("is empty for nothing to do", () => {
    expect(packSettleBatches([], measured)).toEqual([]);
    expect(describeBatches([])).toBe("Nothing to settle.");
  });
});

describe("describeBatches", () => {
  it("says the trade a person is being offered, in approvals", () => {
    const batches = packSettleBatches(Array.from({ length: 82 }, (_, i) => i), measured);
    expect(describeBatches(batches)).toBe("82 battles in 11 transactions (2 to 8 each), so 11 approvals rather than 82.");
  });
  it("says it in the singular for one transaction", () => {
    expect(describeBatches(packSettleBatches([1, 2], measured))).toBe("2 battles in 1 transaction (2 each), so 1 approval rather than 2.");
  });
});
