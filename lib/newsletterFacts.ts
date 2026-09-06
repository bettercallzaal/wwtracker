import "server-only";

// Assembles the figures a newsletter is allowed to state, from the same live
// sources the site renders.
//
// This module exists so the AI never sources a number. It is handed these
// facts and writes prose around them. A model asked to "write about last
// week's volume" will invent a plausible figure; a model handed
// "volume.total = 922.297 SOL" cannot. Every number that reaches a subscriber
// traces back to an API response captured here.

import { getPublicStats, getPublicBattles } from "./wavewarzApi";

export { findUnsourcedFigures } from "./newsletterCheck";

export interface NewsletterFacts {
  capturedAt: string;
  /** Rendered as a fact sheet for the model, and shown to the writer verbatim. */
  lines: string[];
  /** Machine-readable, so a later check can confirm the draft did not drift. */
  figures: Record<string, number>;
  errors: string[];
}

const sol = (n: number) => `${n.toFixed(3)} SOL`;

export async function gatherFacts(): Promise<NewsletterFacts> {
  const lines: string[] = [];
  const figures: Record<string, number> = {};
  const errors: string[] = [];

  const [statsRes, battlesRes] = await Promise.allSettled([
    getPublicStats(),
    getPublicBattles({ limit: 8 }),
  ]);

  if (statsRes.status === "fulfilled") {
    const s = statsRes.value;
    figures.volumeTotalSol = s.volume.totalSol;
    figures.volume24hSol = s.volume.last24hSol;
    figures.volume7dSol = s.volume.last7dSol;
    figures.battlesTotal = s.battles.total;
    figures.artistPayoutsSol = s.artistPayouts.totalSol;
    figures.traderClaimsSol = s.traderClaims.totalSol;
    figures.withdrawalCount = s.traderClaims.withdrawalCount;

    lines.push(`All-time trading volume: ${sol(s.volume.totalSol)}`);
    lines.push(`Volume, last 24 hours: ${sol(s.volume.last24hSol)}`);
    lines.push(`Volume, last 7 days: ${sol(s.volume.last7dSol)}`);
    lines.push(`Battles all time: ${s.battles.total}`);
    lines.push(`Paid to artists, all time: ${sol(s.artistPayouts.totalSol)}`);
    lines.push(
      `Claimed by traders, all time: ${sol(s.traderClaims.totalSol)} across ${s.traderClaims.withdrawalCount} withdrawals`,
    );
    if (s.liveBattle) lines.push("A battle is LIVE right now.");
  } else {
    errors.push("Platform stats unavailable");
  }

  if (battlesRes.status === "fulfilled") {
    const recent = battlesRes.value.battles.slice(0, 6);
    figures.recentBattleCount = recent.length;
    if (recent.length) {
      lines.push("");
      lines.push("Most recent battles:");
      for (const b of recent) {
        const a1 = b.artist1?.name ?? "unknown";
        const a2 = b.artist2?.name ?? "unknown";
        const won = b.winnerSide === "artist1" ? a1 : b.winnerSide === "artist2" ? a2 : null;
        lines.push(`  ${a1} vs ${a2}${won ? ` - ${won} won` : " - undecided"}`);
      }
    }
  } else {
    errors.push("Recent battles unavailable");
  }

  return { capturedAt: new Date().toISOString(), lines, figures, errors };
}
