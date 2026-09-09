import { describe, it, expect } from "vitest";
import {
  tradeFeeSplit,
  settlementSplit,
  skipAuctionCost,
  skipLadder,
  platformRevenue,
  FEE_SCHEDULE,
  OBSERVED_CREATION_COST_SOL,
} from "@/lib/feeModel";

describe("feeModel", () => {
  describe("tradeFeeSplit", () => {
    // Three facts, never one. Asserting only "the artist gets 1.005%" passes
    // while the sentence around it is wrong, which is how the old 1.0 / 0.5
    // survived in this module after the correction had already landed
    // elsewhere. The total and the split are the measurement.
    it("takes 1.500% in total", () => {
      expect(tradeFeeSplit(100).totalFeeSol).toBeCloseTo(1.5, 10);
    });

    it("splits that fee 67 / 33, artist to platform", () => {
      const r = tradeFeeSplit(100);
      expect(r.artistSol / r.totalFeeSol).toBeCloseTo(0.67, 10);
      expect(r.platformSol / r.totalFeeSol).toBeCloseTo(0.33, 10);
    });

    it("so the artist takes 1.005% of a trade and the platform 0.495%", () => {
      const result = tradeFeeSplit(100);
      expect(result.artistSol).toBeCloseTo(1.005, 10);
      expect(result.platformSol).toBeCloseTo(0.495, 10);
    });

    it("sums to exactly the input volume times 1.5%", () => {
      const volume = 12345.6789;
      const result = tradeFeeSplit(volume);
      const total = result.artistSol + result.platformSol;
      expect(total).toBeCloseTo(volume * 0.015, 10);
    });

    it("handles zero volume", () => {
      const result = tradeFeeSplit(0);
      expect(result.artistSol).toBeCloseTo(0, 10);
      expect(result.platformSol).toBeCloseTo(0, 10);
      expect(result.totalFeeSol).toBeCloseTo(0, 10);
    });

    it("handles negative volume by clamping to zero", () => {
      const result = tradeFeeSplit(-100);
      expect(result.artistSol).toBeCloseTo(0, 10);
      expect(result.platformSol).toBeCloseTo(0, 10);
      expect(result.totalFeeSol).toBeCloseTo(0, 10);
    });

    it("handles non-finite input by clamping to zero", () => {
      expect(tradeFeeSplit(Infinity).totalFeeSol).toBeCloseTo(0, 10);
      expect(tradeFeeSplit(NaN).totalFeeSol).toBeCloseTo(0, 10);
    });

    it("gives the artist just over twice the platform, not exactly twice", () => {
      // 67/33 is 2.03x. The old constants were 1.0 and 0.5, which is exactly
      // 2x - a rounder number than the program actually produces, and the
      // roundness is part of why nobody questioned it.
      const result = tradeFeeSplit(1000);
      expect(result.artistSol / result.platformSol).toBeCloseTo(0.67 / 0.33, 10);
      expect(result.artistSol / result.platformSol).toBeGreaterThan(2);
    });
  });

  describe("settlementSplit", () => {
    it("splits losing pool into 50/40/5/2/3", () => {
      const result = settlementSplit(100);
      expect(result.losingTraders).toBeCloseTo(50, 10);
      expect(result.winningTraders).toBeCloseTo(40, 10);
      expect(result.winningArtist).toBeCloseTo(5, 10);
      expect(result.losingArtist).toBeCloseTo(2, 10);
      expect(result.platform).toBeCloseTo(3, 10);
    });

    it("sums to exactly 100% of the input pool", () => {
      const pool = 54321.987;
      const result = settlementSplit(pool);
      const total =
        result.losingTraders +
        result.winningTraders +
        result.winningArtist +
        result.losingArtist +
        result.platform;
      expect(total).toBeCloseTo(pool, 10);
    });

    it("handles zero pool", () => {
      const result = settlementSplit(0);
      expect(result.losingTraders).toBeCloseTo(0, 10);
      expect(result.winningTraders).toBeCloseTo(0, 10);
      expect(result.winningArtist).toBeCloseTo(0, 10);
      expect(result.losingArtist).toBeCloseTo(0, 10);
      expect(result.platform).toBeCloseTo(0, 10);
    });

    it("handles negative pool by clamping to zero", () => {
      const result = settlementSplit(-50);
      expect(result.losingTraders).toBeCloseTo(0, 10);
      expect(result.platform).toBeCloseTo(0, 10);
    });

    it("handles non-finite input by clamping to zero", () => {
      const result = settlementSplit(NaN);
      expect(result.platform).toBeCloseTo(0, 10);
    });
  });

  describe("skipAuctionCost", () => {
    it("returns 0.02 SOL when queue is empty", () => {
      expect(skipAuctionCost(0)).toBeCloseTo(0.02, 10);
    });

    it("adds 0.01 to the current front price", () => {
      expect(skipAuctionCost(0.02)).toBeCloseTo(0.03, 10);
      expect(skipAuctionCost(0.03)).toBeCloseTo(0.04, 10);
      expect(skipAuctionCost(0.1)).toBeCloseTo(0.11, 10);
    });

    it("handles negative input by clamping and returning 0.02", () => {
      expect(skipAuctionCost(-0.05)).toBeCloseTo(0.02, 10);
    });

    it("handles non-finite input by clamping and returning 0.02", () => {
      expect(skipAuctionCost(Infinity)).toBeCloseTo(0.02, 10);
    });
  });

  describe("skipLadder", () => {
    it("returns the first n skip prices starting from 0.02", () => {
      const ladder = skipLadder(5);
      expect(ladder).toEqual([0.02, 0.03, 0.04, 0.05, 0.06]);
    });

    it("handles zero count", () => {
      expect(skipLadder(0)).toEqual([]);
    });

    it("handles negative count by returning empty array", () => {
      expect(skipLadder(-5)).toEqual([]);
    });

    it("handles non-integer count by flooring", () => {
      const ladder = skipLadder(3.7);
      expect(ladder).toHaveLength(3);
      expect(ladder).toEqual([0.02, 0.03, 0.04]);
    });

    it("each price increments by exactly 0.01", () => {
      const ladder = skipLadder(10);
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i]).toBeCloseTo(ladder[i - 1] + 0.01, 10);
      }
    });
  });

  describe("platformRevenue", () => {
    it("sums all revenue sources", () => {
      const input = {
        volumeSol: 1000,
        losingPoolSol: 500,
        quickBattles: 10,
        communityBattles: 5,
        skipFeesSol: 0.5,
      };
      const result = platformRevenue(input);

      // Launch fees are NOT in the total. Measured 2026-09-06: the treasury
      // receives nothing on battle creation, in 20 of 20 transactions. Adding
      // them here is what put 1,052.879 SOL on the homepage against a measured
      // 19.38 - a 54x overstatement, live, until 2026-09-09.
      const expected =
        1000 * 0.015 * 0.33 + // trade fee: 0.495% of volume
        500 * 0.03 + // settlement fee
        0.5; // skip fees

      expect(result.totalSol).toBeCloseTo(expected, 10);
      // Still returned, because the counterfactual is worth showing.
      expect(result.modelledLaunchFeesSol).toBeCloseTo(10 * 0.69 + 5 * 4, 10);
    });

    it("breaks down revenue by source", () => {
      const input = {
        volumeSol: 1000,
        losingPoolSol: 500,
        quickBattles: 10,
        communityBattles: 5,
        skipFeesSol: 0.5,
      };
      const result = platformRevenue(input);

      expect(result.tradeFeeSol).toBeCloseTo(4.95, 10); // 1000 * 0.495%
      expect(result.settlementFeeSol).toBeCloseTo(15, 10); // 500 * 3%
      expect(result.quickBattleLaunchFeesSol).toBeCloseTo(6.9, 10); // 10 * 0.69
      expect(result.communityBattleLaunchFeesSol).toBeCloseTo(20, 10); // 5 * 4
      expect(result.skipQueueFeeSol).toBeCloseTo(0.5, 10);
    });

    it("handles zero inputs", () => {
      const result = platformRevenue({
        volumeSol: 0,
        losingPoolSol: 0,
        quickBattles: 0,
        communityBattles: 0,
        skipFeesSol: 0,
      });
      expect(result.totalSol).toBeCloseTo(0, 10);
    });

    it("handles negative inputs by clamping", () => {
      const result = platformRevenue({
        volumeSol: -100,
        losingPoolSol: -50,
        quickBattles: -5,
        communityBattles: -2,
        skipFeesSol: -0.5,
      });
      expect(result.totalSol).toBeCloseTo(0, 10);
    });

    it("floors battle counts to integers", () => {
      const result = platformRevenue({
        volumeSol: 0,
        losingPoolSol: 0,
        quickBattles: 3.9,
        communityBattles: 2.1,
        skipFeesSol: 0,
      });
      expect(result.quickBattleLaunchFeesSol).toBeCloseTo(3 * 0.69, 10);
      expect(result.communityBattleLaunchFeesSol).toBeCloseTo(2 * 4, 10);
    });
  });

  describe("Fee schedule constants", () => {
    it("exports all required fee percentages", () => {
      expect(FEE_SCHEDULE.TOTAL_TRADE_FEE).toBe(0.015);
      expect(FEE_SCHEDULE.ARTIST_SPLIT).toBe(0.67);
      expect(FEE_SCHEDULE.PLATFORM_SPLIT).toBe(0.33);
      expect(FEE_SCHEDULE.ARTIST_TRADE_FEE).toBeCloseTo(0.01005, 10);
      expect(FEE_SCHEDULE.PLATFORM_TRADE_FEE).toBeCloseTo(0.00495, 10);
      expect(FEE_SCHEDULE.TOTAL_TRADE_FEE).toBe(0.015);
    });

    it("exports all settlement split percentages", () => {
      expect(FEE_SCHEDULE.SETTLEMENT_LOSING_TRADERS).toBe(0.5);
      expect(FEE_SCHEDULE.SETTLEMENT_WINNING_TRADERS).toBe(0.4);
      expect(FEE_SCHEDULE.SETTLEMENT_WINNING_ARTIST).toBe(0.05);
      expect(FEE_SCHEDULE.SETTLEMENT_LOSING_ARTIST).toBe(0.02);
      expect(FEE_SCHEDULE.SETTLEMENT_PLATFORM).toBe(0.03);
    });

    it("exports all launch fees", () => {
      expect(FEE_SCHEDULE.QUICK_BATTLE_LAUNCH_FEE).toBe(0.69);
      expect(FEE_SCHEDULE.COMMUNITY_BATTLE_LAUNCH_FEE).toBe(4);
    });

    it("exports skip-queue auction parameters", () => {
      expect(FEE_SCHEDULE.SKIP_QUEUE_BASE).toBe(0.02);
      expect(FEE_SCHEDULE.SKIP_QUEUE_INCREMENT).toBe(0.01);
    });
  });

  describe("realistic worked example", () => {
    it("calculates lifetime revenue from platform volume", () => {
      // Hypothetical: 10k SOL lifetime volume
      const result = platformRevenue({
        volumeSol: 10000,
        losingPoolSol: 0, // Not tracking settlement pool in this example
        quickBattles: 50,
        communityBattles: 10,
        skipFeesSol: 15,
      });

      // Trade fees: 10000 * 0.495% = 49.5 SOL
      // Skip fees:  15 SOL
      // Total:      64.5 SOL - launch fees excluded, they are not collected.
      // Modelled launch fees: (50 * 0.69) + (10 * 4) = 74.5 SOL, reported
      //   separately so the counterfactual is visible without being income.

      expect(result.tradeFeeSol).toBeCloseTo(49.5, 10);
      expect(result.quickBattleLaunchFeesSol).toBeCloseTo(34.5, 10);
      expect(result.communityBattleLaunchFeesSol).toBeCloseTo(40, 10);
      expect(result.modelledLaunchFeesSol).toBeCloseTo(74.5, 10);
      expect(result.skipQueueFeeSol).toBeCloseTo(15, 10);
      expect(result.totalSol).toBeCloseTo(64.5, 10);
    });

    it("shows the artist keeping the larger share over a lifetime of volume", () => {
      const volume = 50000; // 50k SOL lifetime volume
      const split = tradeFeeSplit(volume);

      // 1.500% of 50,000 is 750 SOL of fee, split 67/33.
      expect(split.totalFeeSol).toBeCloseTo(750, 10);
      expect(split.artistSol).toBeCloseTo(502.5, 10);
      expect(split.platformSol).toBeCloseTo(247.5, 10);
      expect(split.artistSol + split.platformSol).toBeCloseTo(split.totalFeeSol, 10);
    });
  });
});

describe("uncollected fees stay out of the revenue total", () => {
  it("does not put a thousand SOL of uncharged launch fees on the page", () => {
    // The exact live inputs on 2026-09-09: 923.1038 SOL volume, 1,299 quick
    // and 38 community battles. components/FeeModel.tsx renders totalSol under
    // "TOTAL PLATFORM REVENUE", and it read 1,052.879 SOL. Measured platform
    // revenue from every source, lifetime, is 19.38 SOL.
    const r = platformRevenue({
      volumeSol: 923.1038,
      losingPoolSol: 0,
      quickBattles: 1299,
      communityBattles: 38,
      skipFeesSol: 0,
    });
    expect(r.totalSol).toBeLessThan(20);
    expect(r.modelledLaunchFeesSol).toBeGreaterThan(1000);
    // The headline must not contain the model, at any input.
    expect(r.totalSol).toBeCloseTo(r.tradeFeeSol + r.settlementFeeSol + r.skipQueueFeeSol, 10);
  });

  it("keeps the total free of launch fees however many battles there are", () => {
    const none = platformRevenue({
      volumeSol: 100, losingPoolSol: 10, quickBattles: 0, communityBattles: 0, skipFeesSol: 1,
    });
    const many = platformRevenue({
      volumeSol: 100, losingPoolSol: 10, quickBattles: 5000, communityBattles: 900, skipFeesSol: 1,
    });
    expect(many.totalSol).toBeCloseTo(none.totalSol, 10);
  });
});

// Added 2026-09-06 after measuring battle creation on mainnet.
describe("launch fees, measured against the schedule", () => {
  it("keeps the scheduled fees available as a model", () => {
    expect(FEE_SCHEDULE.QUICK_BATTLE_LAUNCH_FEE).toBe(0.69);
    expect(FEE_SCHEDULE.COMMUNITY_BATTLE_LAUNCH_FEE).toBe(4);
  });

  // Twenty creation transactions inspected on mainnet: the treasury received
  // nothing in any of them, and the creator paid about 0.0039 SOL in rent.
  // Battle creation is a cost, not income. See docs/LAUNCH-FEES.md.
  it("records the observed creation cost, which is a cost not a fee", () => {
    expect(OBSERVED_CREATION_COST_SOL).toBeGreaterThan(0);
    expect(OBSERVED_CREATION_COST_SOL).toBeLessThan(0.01);
  });

  // The gap between what is scheduled and what is collected is the whole point
  // of the document. If these ever converge, something changed on chain.
  it("keeps the scheduled fee far above the observed cost", () => {
    expect(FEE_SCHEDULE.QUICK_BATTLE_LAUNCH_FEE)
      .toBeGreaterThan(OBSERVED_CREATION_COST_SOL * 100);
  });
});
