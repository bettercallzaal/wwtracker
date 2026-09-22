/**
 * "Sent" is not "landed". The trade route returned success the moment a node
 * accepted the broadcast, and both panels showed a green Sent with a
 * signature. A transaction accepted for relay can still be dropped or expire
 * without ever landing, and the person was told it happened.
 *
 * The three outcomes are kept apart on purpose: unknown is not a failure.
 */
import { describe, expect, it, vi } from "vitest";
import { confirmSignature, describeConfirmation, isLanded } from "../ww/confirm";

const noSleep = async () => {};
const SIG = "2HhRr7hMZLfxFT5qAwxeS5eG6g356EBbPDedSM4wWAr7mLC9geqx7tcva5Ug8z74utWRyr2niYaauq2pYkVieTnK";

describe("isLanded", () => {
  it("is true only at confirmed or finalized", () => {
    expect(isLanded({ confirmationStatus: "confirmed" })).toBe(true);
    expect(isLanded({ confirmationStatus: "finalized" })).toBe(true);
  });
  it("is false at processed, which is one node's word and can be forked away", () => {
    expect(isLanded({ confirmationStatus: "processed" })).toBe(false);
  });
  it("is false for an error or for never having been seen", () => {
    expect(isLanded({ confirmationStatus: "finalized", err: { InstructionError: [0, "x"] } })).toBe(false);
    expect(isLanded(null)).toBe(false);
  });
});

describe("confirmSignature", () => {
  it("lands as soon as the cluster has confirmed it", async () => {
    const readStatus = vi.fn().mockResolvedValue({ confirmationStatus: "confirmed", slot: 1 });
    const r = await confirmSignature({ readStatus, sleep: noSleep });
    expect(r.outcome).toBe("landed");
    expect(r.attempts).toBe(1);
  });

  it("keeps looking while the RPC has not seen it, then lands", async () => {
    const readStatus = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ confirmationStatus: "processed" })
      .mockResolvedValue({ confirmationStatus: "confirmed" });
    const r = await confirmSignature({ readStatus, sleep: noSleep });
    expect(r).toMatchObject({ outcome: "landed", attempts: 3 });
  });

  it("reports the chain's own error rather than a guess", async () => {
    const err = { InstructionError: [2, { Custom: 6014 }] };
    const r = await confirmSignature({ readStatus: async () => ({ err, confirmationStatus: "confirmed" }), sleep: noSleep });
    expect(r.outcome).toBe("failed");
    expect(r.error).toContain("6014");
  });

  /**
   * THE CASE THAT MATTERS MOST. Never seen by the RPC within the budget is
   * NOT a failure: the transaction may land a moment later, and telling
   * somebody it failed invites them to trade twice.
   */
  it("says unknown, not failed, when it never appears in time", async () => {
    const readStatus = vi.fn().mockResolvedValue(null);
    const r = await confirmSignature({ readStatus, attempts: 4, sleep: noSleep });
    expect(r).toMatchObject({ outcome: "unknown", error: null, attempts: 4 });
    expect(readStatus).toHaveBeenCalledTimes(4);
  });

  it("waits between attempts and not after the last", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    await confirmSignature({ readStatus: async () => null, attempts: 3, delayMs: 2_000, sleep });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });
});

describe("describeConfirmation", () => {
  it("says landed, failed and unknown differently, and never calls unknown a failure", () => {
    const landed = describeConfirmation({ outcome: "landed", error: null, confirmationStatus: "confirmed", attempts: 1 }, SIG);
    const failed = describeConfirmation({ outcome: "failed", error: "Custom: 6014", confirmationStatus: "confirmed", attempts: 1 }, SIG);
    const unknown = describeConfirmation({ outcome: "unknown", error: null, confirmationStatus: null, attempts: 12 }, SIG);
    expect(landed).toMatch(/Confirmed on chain/);
    expect(failed).toMatch(/rejected it: Custom: 6014/);
    expect(unknown).toMatch(/not confirmed yet/);
    expect(unknown).not.toMatch(/failed|rejected/i);
    // The signature is shown in every case, because it is what a person needs
    // to check for themselves.
    for (const s of [landed, failed, unknown]) expect(s).toContain(SIG.slice(0, 8));
  });
});
