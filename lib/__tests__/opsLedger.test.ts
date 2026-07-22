import { describe, it, expect } from "vitest";
import {
  activeMonthlyTotalUsd,
  sumUsd,
  TECH_STACK,
  MONTHLY_LEDGERS,
  TREASURY_SNAPSHOTS,
  LIVE_TREASURY_SNAPSHOT,
  type TechStackItem,
  type LedgerLineItem,
} from "@/lib/opsLedger";

describe("sumUsd", () => {
  it("sums items that have a usd amount", () => {
    const items: LedgerLineItem[] = [{ label: "a", amountUsd: 20 }, { label: "b", amountUsd: 5 }];
    expect(sumUsd(items)).toBe(25);
  });

  it("treats items with no usd amount (e.g. SOL-only) as 0", () => {
    const items: LedgerLineItem[] = [{ label: "a", amountUsd: 20 }, { label: "b", amountSol: 0.12 }];
    expect(sumUsd(items)).toBe(20);
  });

  it("returns 0 for an empty list", () => {
    expect(sumUsd([])).toBe(0);
  });
});

describe("activeMonthlyTotalUsd", () => {
  it("includes only active items, normalizing weekly to monthly", () => {
    const items: TechStackItem[] = [
      { name: "a", amountUsd: 20, cadence: "monthly", active: true },
      { name: "b", amountUsd: 100, cadence: "monthly", active: false },
      { name: "c", amountUsd: 10, cadence: "weekly", active: true },
    ];
    expect(activeMonthlyTotalUsd(items)).toBeCloseTo(20 + 10 * 4.33, 5);
  });

  it("is 0 when nothing is active", () => {
    const items: TechStackItem[] = [{ name: "a", amountUsd: 20, cadence: "monthly", active: false }];
    expect(activeMonthlyTotalUsd(items)).toBe(0);
  });
});

describe("data sanity", () => {
  it("TECH_STACK has exactly the 3 currently-active items and 2 lapsed", () => {
    expect(TECH_STACK.filter((i) => i.active)).toHaveLength(3);
    expect(TECH_STACK.filter((i) => !i.active)).toHaveLength(2);
  });

  it("MONTHLY_LEDGERS covers November and December 2025", () => {
    expect(MONTHLY_LEDGERS.map((l) => l.month)).toEqual(["2025-11", "2025-12"]);
  });

  it("November's stated total matches its own P&L math (income - expenses)", () => {
    const nov = MONTHLY_LEDGERS[0];
    expect(nov.statedTotalIncomeUsd! - nov.statedTotalExpensesUsd!).toBeCloseTo(nov.statedProfitLossUsd!, 2);
  });

  it("December's expense total and P&L are left unset rather than guessed", () => {
    const dec = MONTHLY_LEDGERS[1];
    expect(dec.statedTotalExpensesUsd).toBeNull();
    expect(dec.statedProfitLossUsd).toBeNull();
  });

  it("TREASURY_SNAPSHOTS are all marked unverified (manual team notes)", () => {
    expect(TREASURY_SNAPSHOTS.every((s) => s.verified === false)).toBe(true);
  });

  it("LIVE_TREASURY_SNAPSHOT is marked verified with no invented WARZ price", () => {
    expect(LIVE_TREASURY_SNAPSHOT.verified).toBe(true);
    expect(LIVE_TREASURY_SNAPSHOT.warzUsd).toBeNull();
    expect(LIVE_TREASURY_SNAPSHOT.solUsd).not.toBeNull();
  });
});
