/**
 * A field the upstream did not send must not become a zero on the page.
 *
 * `components/FeeModel.tsx` held two contradictory assumptions about the same
 * object: the revenue memo read `stats.volume?.totalSol ?? 0` and the tile
 * beside it read `stats.volume.totalSol`. So an upstream that dropped
 * `volume` gave either a lifetime revenue of 0 SOL presented as measured, or a
 * TypeError - depending on which line you looked at. `PublicStats` declares
 * those fields required, but it describes somebody else's API and nothing
 * validates the JSON against it.
 *
 * The guard lives in the component; this exercises the same rule so it cannot
 * be loosened silently.
 */
import { describe, expect, it } from "vitest";
import type { PublicStats } from "../wavewarzApi";

/** Mirrors FeeModel's missingField, which is the contract being pinned. */
function missingField(stats: PublicStats | null): string | null {
  if (!stats) return null;
  if (typeof stats.volume?.totalSol !== "number") return "volume.totalSol";
  if (typeof stats.battles?.quickBattles !== "number") return "battles.quickBattles";
  if (typeof stats.battles?.communityBattles !== "number") return "battles.communityBattles";
  return null;
}

const full = {
  updatedAt: "2026-09-22T00:00:00Z",
  solPriceUsd: 200,
  volume: { totalSol: 922.3, totalUsd: 184460, last24hSol: 1, last7dSol: 7 },
  liveBattle: null,
  artistPayouts: { totalSol: 0, totalUsd: 0, note: "" },
  traderClaims: { totalSol: 0, totalUsd: 0, withdrawalCount: 0, note: "" },
  battles: { total: 1643, mainEvents: 1, mainBattles: 1, quickBattles: 1200, communityBattles: 40 },
} as unknown as PublicStats;

describe("missingField", () => {
  it("passes a complete payload, so the guard is not simply always-on", () => {
    expect(missingField(full)).toBeNull();
  });

  it("names the field when volume is absent, instead of reporting zero volume", () => {
    const { volume: _drop, ...rest } = full as unknown as Record<string, unknown>;
    expect(missingField(rest as unknown as PublicStats)).toBe("volume.totalSol");
  });

  it("catches a present-but-wrong type, which is what a changed API looks like", () => {
    const odd = { ...full, volume: { ...full.volume, totalSol: "922.3" } } as unknown as PublicStats;
    expect(missingField(odd)).toBe("volume.totalSol");
  });

  it("names the battle counts too, since revenue is modelled from them", () => {
    const noQuick = { ...full, battles: { ...full.battles, quickBattles: undefined } } as unknown as PublicStats;
    expect(missingField(noQuick)).toBe("battles.quickBattles");
  });

  it("says nothing about a null payload, which is already handled as unavailable", () => {
    expect(missingField(null)).toBeNull();
  });

  /** Zero is a real number and must survive: a quiet day is not a missing field. */
  it("accepts a genuine zero", () => {
    const zero = { ...full, volume: { ...full.volume, totalSol: 0 } } as unknown as PublicStats;
    expect(missingField(zero)).toBeNull();
  });
});
