/**
 * Reading again until the answer changes. Written after the widget read a
 * wallet's balance once, immediately after a trade, got the pre-trade 0 that
 * an unprocessed RPC correctly returns, and told the person they held nothing.
 */
import { describe, expect, it, vi } from "vitest";
import { pollForChange } from "../ww/pollForChange";

const noSleep = async () => {};

describe("pollForChange", () => {
  it("stops at the first read when the value has already changed", async () => {
    const read = vi.fn().mockResolvedValue(5);
    const r = await pollForChange({ read, from: 0, sleep: noSleep });
    expect(r).toEqual({ value: 5, changed: true, attempts: 1 });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps reading while the answer is still the old one, and reports when it moves", async () => {
    const read = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValue(10_800_000);
    const r = await pollForChange({ read, from: 0, sleep: noSleep });
    expect(r).toEqual({ value: 10_800_000, changed: true, attempts: 3 });
  });

  it("gives up after the attempt budget and says it did NOT change, with the last value", async () => {
    const read = vi.fn().mockResolvedValue(0);
    const r = await pollForChange({ read, from: 0, attempts: 4, sleep: noSleep });
    expect(r).toEqual({ value: 0, changed: false, attempts: 4 });
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("waits between attempts, and not after the last one", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    await pollForChange({ read: async () => 0, from: 0, attempts: 3, delayMs: 1_500, sleep });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_500);
  });

  it("takes a custom sameness test, for values that are not primitives", async () => {
    const from = { a: 0, b: 0 };
    const read = vi.fn().mockResolvedValueOnce({ a: 0, b: 0 }).mockResolvedValue({ a: 10, b: 0 });
    const same = (x: { a: number; b: number }, y: { a: number; b: number }) => x.a === y.a && x.b === y.b;
    const r = await pollForChange({ read, from, same, sleep: noSleep });
    expect(r.changed).toBe(true);
    expect(r.value).toEqual({ a: 10, b: 0 });
  });

  it("always makes at least one read, however small the budget", async () => {
    const read = vi.fn().mockResolvedValue(1);
    await pollForChange({ read, from: 1, attempts: 0, sleep: noSleep });
    expect(read).toHaveBeenCalledTimes(1);
  });
});
