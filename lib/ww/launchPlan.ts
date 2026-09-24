/**
 * What launching a battle creates, and what it costs, before anyone signs.
 *
 * WHAT WAS ESTABLISHED FIRST, because everything here rests on it.
 * `initializeBattle` takes an account named `admin` that must sign, and every
 * battle on chain was created by the platform treasury - equally consistent
 * with "only they can" and "only they do". `instructions.ts` asserted "any
 * wallet" in a comment that nothing had checked, and the IDL's 28 custom
 * errors contain no Unauthorized (which proves little: an Anchor address
 * constraint fails from the framework's own range).
 *
 * Simulated 2026-09-24 with `sigVerify: false` from a wallet that is not the
 * treasury, against a fresh battle id whose accounts did not exist:
 *
 *     Program log: Instruction: InitializeBattle
 *     Program log: Battle initialized with ID 1790211141 starting at 1790211141
 *     Program log: Instruction: InitializeMints
 *     Program log: Mints initialized for battle 1790211141
 *     WOULD SUCCEED. units consumed: 50497
 *
 * **The program is permissionless for launching.** Anyone can create a battle.
 * That is what makes a community-run battle possible without the platform.
 *
 * FOUR ACCOUNTS ARE CREATED AND THE CREATOR PAYS RENT ON ALL OF THEM. The
 * battle (353 bytes), the vault, and two mints (82 bytes each). None of the
 * instructions closes an account, so that rent is spent, not deposited: a
 * caller who expects it back when the battle settles will be wrong. Said here
 * because a launch screen that shows a number without saying which kind of
 * number it is invites exactly that.
 *
 * RENT IS ASKED OF THE CLUSTER, NEVER HARDCODED. It is a function of account
 * size and of a cluster parameter, so a constant here would be a quoted cost
 * that goes stale with nobody noticing. This module takes the numbers it is
 * given and composes them; the caller fetches them.
 */

/** A battle account, from `discovery.ts`. */
export const BATTLE_ACCOUNT_BYTES = 353;
/** An SPL mint. */
export const MINT_ACCOUNT_BYTES = 82;
/** The vault is a system account holding lamports and no data. */
export const VAULT_ACCOUNT_BYTES = 0;

/** The accounts a launch creates, in the order the program creates them. */
export const LAUNCH_ACCOUNTS: ReadonlyArray<{ name: string; bytes: number }> = [
  { name: "battle account", bytes: BATTLE_ACCOUNT_BYTES },
  { name: "vault", bytes: VAULT_ACCOUNT_BYTES },
  { name: "artist A mint", bytes: MINT_ACCOUNT_BYTES },
  { name: "artist B mint", bytes: MINT_ACCOUNT_BYTES },
];

export interface LaunchCost {
  lines: Array<{ name: string; bytes: number; lamports: number }>;
  rentLamports: number;
  /** Null when the cluster did not quote one. Never silently zero. */
  networkFeeLamports: number | null;
  /** Rent plus the fee. When the fee is unknown this is a floor, and `isFloor` says so. */
  totalLamports: number;
  isFloor: boolean;
}

/**
 * `rentFor` maps a byte size to its rent-exempt minimum, as the cluster
 * answered. A missing entry throws rather than defaulting: a launch quoted
 * without one of its four accounts is a quote that is wrong by the amount
 * nobody was told about.
 */
export function launchCost(
  rentFor: ReadonlyMap<number, number>,
  networkFeeLamports: number | null,
): LaunchCost {
  const lines = LAUNCH_ACCOUNTS.map(({ name, bytes }) => {
    const lamports = rentFor.get(bytes);
    if (lamports === undefined) {
      throw new Error(`no rent quoted for ${name} (${bytes} bytes); refusing to quote a partial cost`);
    }
    return { name, bytes, lamports };
  });
  const rentLamports = lines.reduce((sum, l) => sum + l.lamports, 0);
  return {
    lines,
    rentLamports,
    networkFeeLamports,
    totalLamports: rentLamports + (networkFeeLamports ?? 0),
    isFloor: networkFeeLamports === null,
  };
}

/** Can this balance pay for the launch. UNKNOWN propagates rather than becoming false. */
export function canAfford(balanceLamports: number, cost: LaunchCost): boolean | null {
  if (cost.isFloor) return balanceLamports < cost.totalLamports ? false : null;
  return balanceLamports >= cost.totalLamports;
}

export interface LaunchParams {
  battleId: number;
  durationSeconds: number;
  artistA: string;
  artistB: string;
}

export type LaunchCheck = { ok: true } | { ok: false; reason: string };

/**
 * Refuse a launch that would create something nobody can use.
 *
 * A battle id IS its start time in unix seconds, so the id and the clock are
 * the same field and an id in the past is a battle that opened before it
 * existed. `discovery.ts` guards the same range from the other direction.
 */
export function checkLaunch(p: LaunchParams, nowSeconds: number): LaunchCheck {
  if (!Number.isInteger(p.battleId) || p.battleId <= 0) {
    return { ok: false, reason: "battle id must be a positive whole number of unix seconds" };
  }
  if (!Number.isInteger(p.durationSeconds) || p.durationSeconds <= 0) {
    return { ok: false, reason: "duration must be a positive whole number of seconds" };
  }
  // A START SLIGHTLY IN THE PAST IS LEGAL, AND THE FIRST VERSION OF THIS
  // REFUSED IT. The rule was "the start time has already passed", which sounds
  // right and is not: a battle whose start is a second ago is simply already
  // trading, and every real launch lands a few seconds after it is built. The
  // rule also made the one proof that matters impossible - launching and
  // buying in ONE transaction, which needs the battle active by the time the
  // buy runs, and therefore needs a start at or before now.
  //
  // What is genuinely unusable is a battle that is already OVER. That is the
  // rule.
  if (p.battleId + p.durationSeconds <= nowSeconds) {
    return {
      ok: false,
      reason: "this battle would already be over: its start plus its duration is in the past",
    };
  }

  // 24 hours is not an arbitrary ceiling: 26 battles on chain ran exactly
  // 86,400 seconds, so it is a real length, and anything past it has no
  // precedent to lean on.
  if (p.durationSeconds > 86_400) {
    return { ok: false, reason: "duration longer than 24 hours, which no battle on chain has run" };
  }
  if (p.artistA === p.artistB) {
    return { ok: false, reason: "both sides name the same wallet, so there is nothing to bet between" };
  }
  for (const [label, key] of [["artist A", p.artistA], ["artist B", p.artistB]] as const) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key)) {
      return { ok: false, reason: `${label} is not a base58 address` };
    }
  }
  return { ok: true };
}
