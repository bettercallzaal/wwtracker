// WaveWarZ operating costs + monthly P&L, as reported by the team (not
// derivable on-chain - these are real-world bills and revenue lines). Kept
// separate from lib/distributions.ts, which tracks the 33/22/22/22 profit
// SPLIT once the treasury clears its floor; this file tracks what it costs
// to run the platform day to day and what's coming in against that.
//
// Figures below are transcribed verbatim from the team's own notes. Where a
// stated total doesn't match the sum of its line items, or a field was left
// blank in the source, that's flagged explicitly rather than silently
// corrected or filled in - see each MonthlyLedger's `note`.

export interface TechStackItem {
  name: string;
  amountUsd: number;
  cadence: "monthly" | "weekly";
  /** Currently paid for (true) or lapsed/not active (false), per the team's own tracking. */
  active: boolean;
  note?: string;
}

export const TECH_STACK: TechStackItem[] = [
  { name: "Vercel", amountUsd: 20, cadence: "monthly", active: true },
  {
    name: "Helius mainnet RPC",
    amountUsd: 49,
    cadence: "monthly",
    active: true,
    note: "1M calls/mo included, then metered. Account is on hurric4n3ike's own Google login, not a shared WaveWarZ account.",
  },
  {
    name: "Cloudflare Workers",
    amountUsd: 5.99,
    cadence: "monthly",
    active: true,
    note: "10M requests/mo included, then metered.",
  },
  { name: "Restream (Candy Lui)", amountUsd: 19, cadence: "monthly", active: false },
  {
    name: "VA",
    amountUsd: 49,
    cadence: "weekly",
    active: false,
    note: "Max $70/wk; usual pace is ~1hr/day, which runs closer to $49/wk.",
  },
];

/** Sum of currently-active items, normalized to a monthly figure (weekly x 4.33). */
export function activeMonthlyTotalUsd(items: TechStackItem[]): number {
  return items
    .filter((i) => i.active)
    .reduce((sum, i) => sum + (i.cadence === "weekly" ? i.amountUsd * 4.33 : i.amountUsd), 0);
}

export interface IncomeStreamItem {
  name: string;
  amountUsd: number;
  cadence: "monthly" | "one-time";
  /** Currently recurring (true) or a one-off that already happened (false). */
  active: boolean;
  note?: string;
}

export const ACTIVE_INCOME_STREAMS: IncomeStreamItem[] = [
  { name: "Sponsorship - rj", amountUsd: 50, cadence: "monthly", active: true },
  {
    name: "Sponsorship - Sigea",
    amountUsd: 75,
    cadence: "one-time",
    active: false,
    note: "Largest single sponsorship received to date - a one-off, not a recurring source.",
  },
];

/** Sum of currently-recurring monthly income streams (excludes one-time entries). */
export function activeMonthlyIncomeUsd(items: IncomeStreamItem[]): number {
  return items.filter((i) => i.active && i.cadence === "monthly").reduce((sum, i) => sum + i.amountUsd, 0);
}

export interface LedgerLineItem {
  label: string;
  amountUsd?: number | null;
  amountSol?: number | null;
  note?: string;
}

/** Sum of whichever line items have a usd amount - not a claim about the "true" total, just what's itemized. */
export function sumUsd(items: LedgerLineItem[]): number {
  return items.reduce((sum, i) => sum + (i.amountUsd ?? 0), 0);
}

export interface MonthlyLedger {
  month: string;
  label: string;
  expenses: LedgerLineItem[];
  income: LedgerLineItem[];
  /** The total exactly as the team stated it - may not equal sumUsd(expenses)/sumUsd(income). */
  statedTotalExpensesUsd: number | null;
  statedTotalIncomeUsd: number | null;
  statedProfitLossUsd: number | null;
  note?: string;
}

export const MONTHLY_LEDGERS: MonthlyLedger[] = [
  {
    month: "2025-11",
    label: "November 2025",
    expenses: [
      { label: "Vercel", amountUsd: 20 },
      { label: "Helius", amountUsd: 49 },
      { label: "Cloudflare", amountUsd: 5 },
      { label: "One Jersey", amountUsd: 66 },
      {
        label: "Launching battles",
        amountSol: 0.12,
        note: "includes helping folks with community battles",
      },
      { label: "Repurpose.io", amountUsd: 35 },
      { label: "Windsurf", amountUsd: 15 },
    ],
    income: [
      { label: "Community battles", amountSol: 0.033 },
      { label: "Fees", amountSol: 0.02 },
      { label: "Yoshiro v Davyd (Official WaveWarZ Battle)", amountSol: 0.03 },
      { label: "Merch", amountUsd: 0 },
      { label: "Sponsorships", amountUsd: 0 },
    ],
    statedTotalExpensesUsd: 158.71,
    statedTotalIncomeUsd: 12.94,
    statedProfitLossUsd: -145.77,
    note:
      "Stated total expenses ($158.71) doesn't reconcile with the itemized dollar lines alone (Vercel+Helius+Cloudflare+One Jersey+Repurpose.io+Windsurf = $190, before even adding the 0.12 SOL battle-launch cost). Shown as reported rather than silently corrected - needs the team to clarify which line(s) the $158.71 actually reflects. The stated income ($12.94) does match income items at the implied ~$156/SOL rate used elsewhere in this snapshot, and $12.94 - $158.71 = -$145.77 matches the stated P&L exactly, so $158.71 is the figure that was actually used for the P&L line.",
  },
  {
    month: "2025-12",
    label: "December 2025 (through Dec 6)",
    expenses: [
      { label: "Vercel", amountUsd: 20 },
      { label: "Helius", amountUsd: 49 },
      { label: "Cloudflare", amountUsd: 5 },
      { label: "Launching battles / testing", amountSol: 0.24, note: "including testing Quick BattleZ" },
    ],
    income: [
      { label: "Community battles", amountUsd: 0 },
      { label: "Fees", amountUsd: 0 },
      { label: "GESD1 v JayStreetz (Official WaveWarZ Battle)", amountUsd: 0 },
      { label: "Merch", amountUsd: 0 },
      { label: "Sponsorships", amountUsd: 0 },
      { label: "Pump.fun", amountSol: 0.41 },
    ],
    statedTotalExpensesUsd: null,
    statedTotalIncomeUsd: 55,
    statedProfitLossUsd: null,
    note:
      "Source note left total expenses blank and marked P&L with just a loss indicator, no amount - shown here as not provided rather than estimated, since the SOL->USD rate for this snapshot isn't stated explicitly enough to back it out reliably.",
  },
];

export interface TreasurySnapshot {
  label: string;
  /** ISO date if known, otherwise null - don't guess a date the source didn't give. */
  date: string | null;
  warzAmount: number | null;
  warzUsd: number | null;
  solAmount: number | null;
  solUsd: number | null;
  verified: boolean;
  source: string;
}

export const TREASURY_SNAPSHOTS: TreasurySnapshot[] = [
  {
    label: "Fee wallet note (undated)",
    date: null,
    warzAmount: 7_190_000,
    warzUsd: 40,
    solAmount: 0.384,
    solUsd: 70,
    verified: false,
    source: "Team note - exact date not given; the implied ~$182/SOL rate doesn't match either dated snapshot below, so this likely predates both.",
  },
  {
    label: "November 2025",
    date: "2025-11",
    warzAmount: 7_880_000,
    warzUsd: 50,
    solAmount: 0.19,
    solUsd: 30,
    verified: false,
    source: "Team note.",
  },
  {
    label: "December 6, 2025",
    date: "2025-12-06",
    warzAmount: 7_680_000,
    warzUsd: 42,
    solAmount: 0.38,
    solUsd: 52,
    verified: false,
    source: "Team note.",
  },
];

/**
 * Live snapshot fetched directly from Solana mainnet-beta RPC + CoinGecko,
 * not the team's manual notes - see docs/ARCHITECTURE.md for the fetch
 * commands. WARZ's mint (9dF1hjocKpXc6dER8s25tVujmGQU8zoNNbfWq1FQpump,
 * confirmed via getAsset metadata: name "WaveWarZ", symbol "WARZ") had no
 * active DEX pair on DexScreener as of this date, so its USD value is
 * marked unpriceable rather than guessed.
 */
export const LIVE_TREASURY_SNAPSHOT: TreasurySnapshot = {
  label: "Live on-chain snapshot",
  date: "2026-07-15",
  warzAmount: 6_178_178.71,
  warzUsd: null,
  solAmount: 5.579046457,
  solUsd: 435.82,
  verified: true,
  source:
    "Solana mainnet-beta getBalance/getTokenAccountsByOwner for FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37, SOL/USD via CoinGecko ($78.10/SOL). WARZ mint confirmed via getAsset; no priced DEX pair found (DexScreener), so warzUsd is null rather than estimated.",
};
