/**
 * What settling a battle does, before anyone signs it.
 *
 * endBattle is permissionless. On 2026-09-20 it left 81 battles past their
 * end time with winner_decided still 0, and every claim against one of those
 * fails with BattleNotEnded (6009). Zaal settled six by hand on 09-19. The
 * operator page lists the rest and lets a wallet settle any of them; this
 * module says, per battle, what the program will do, in the program's own
 * numbers.
 *
 * FROM THE PROGRAM'S LOG, battle 1789948124 (EndBattle, 2026-09-21):
 *
 *     Artist A pool: 37886360 SOL          (lamports, the log's unit is mislabelled)
 *     Artist B pool: 1488815340 SOL
 *     Artist B wins with 1488815340 SOL vs 37886360 SOL!
 *     Winner's original pool: 1488815340 lamports
 *     Winner's share from loser pool (40%): 15154544 lamports
 *     Total winner distribution: 1503969884 lamports
 *     Loser share pool (50%): 18943180 lamports
 *
 * and the vault's balance fell by 3,788,635 lamports in that transaction:
 * the remaining 10% of the losing pool (3,788,636) to artists and platform,
 * one lamport short from floored splits. The 40% and 50% legs are integer
 * (loser * 40 / 100, loser * 50 / 100), matching the log exactly.
 *
 * WINNER BY POOL, NOT BY JUDGES. The program settles on the larger pool; the
 * judged result is off chain and can differ. A settle preview says which side
 * the PROGRAM will call the winner, and nothing about who sang better.
 *
 * A TIE GOES TO B, AND IT HAS ALREADY PAID OUT. Battle 1789783495 closed with
 * 49,250,000 lamports on each side and is settled: read from chain
 * 2026-09-22, `winner_decided` (byte 245) is 1 and `winner_artist_a` (byte
 * 244) is 0. So the money went to B in the real case, not just in a
 * simulation. Battle 1790042941 closed the same way on 2026-09-22 and is
 * still unsettled; simulating endBattle on it logs "Winner decided: true,
 * Winner is artist A: false".
 *
 * This file shipped `poolA >= poolB` for a day on 2026-09-22 while
 * `zao-vault/projects/wavewarz-protocol-truths.md` had said the opposite
 * since 09-20, naming 1789783495. The fix came from re-deriving it on chain
 * rather than from reading that file, which is the cheaper check and the one
 * to run first.
 */

export interface SettlePreview {
  /** Which side the program will mark as winner: the larger pool; a tie goes to B (measured). */
  winner: "a" | "b";
  /** Both pools equal. The program picks B; said separately so a page can say so. */
  tie: boolean;
  winnerPoolLamports: number;
  loserPoolLamports: number;
  /** 40% of the losing pool, floored, added to the winner distribution. */
  winnerShareFromLoser: number;
  /** winner pool plus that 40%: what winning holders share pro rata. */
  winnerDistribution: number;
  /** 50% of the losing pool, floored: what losing holders share pro rata. */
  loserSharePool: number;
  /** The remaining 10% of the losing pool, which leaves the vault to artists and platform (within a lamport). */
  leavesVaultLamports: number;
  /** A battle with nothing in either pool settles with nothing to distribute. */
  empty: boolean;
}

export function settlePreview(poolA: number, poolB: number): SettlePreview {
  for (const [k, v] of Object.entries({ poolA, poolB })) {
    if (!Number.isInteger(v) || v < 0) throw new Error(`${k} must be whole lamports >= 0, got ${v}`);
  }
  const winner: "a" | "b" = poolA > poolB ? "a" : "b";
  const win = winner === "a" ? poolA : poolB;
  const lose = winner === "a" ? poolB : poolA;
  const L = BigInt(lose);
  const fortyPct = Number((L * 40n) / 100n);
  const fiftyPct = Number((L * 50n) / 100n);
  return {
    winner,
    tie: poolA === poolB,
    winnerPoolLamports: win,
    loserPoolLamports: lose,
    winnerShareFromLoser: fortyPct,
    winnerDistribution: win + fortyPct,
    loserSharePool: fiftyPct,
    leavesVaultLamports: lose - fortyPct - fiftyPct,
    empty: poolA === 0 && poolB === 0,
  };
}

/** Seconds past end time, for "ended 3 days ago". Never negative. */
export function secondsSinceEnd(endTime: number, nowSeconds: number): number {
  return Math.max(0, nowSeconds - endTime);
}

export function describeAge(seconds: number): string {
  if (seconds < 90) return `${seconds}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 172_800) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86_400)} days ago`;
}
