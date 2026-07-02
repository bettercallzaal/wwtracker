// WaveWarZ profit distribution configuration
// Treasury runs to a 3.5 SOL operating floor; excess is distributed then returned to floor

export const FLOOR_SOL = 3.5;

export interface Recipient {
  name: string;
  wallet?: string; // TODO: add wallet address when available
  percent: number;
}

export const RECIPIENTS: Recipient[] = [
  { name: "WaveWarZ operations", wallet: "", percent: 33 },
  { name: "Hurricane", wallet: "", percent: 22 },
  { name: "Candy", wallet: "", percent: 22 },
  { name: "Zaal", wallet: "", percent: 22 },
];

export interface DistributionEvent {
  date?: string;
  totalSol: number | null; // null = TBD, awaiting founder data
  note?: string;
}

export const DISTRIBUTIONS: DistributionEvent[] = [
  { totalSol: null, note: "TBD - awaiting founder data (distribution 1)" },
  { totalSol: null, note: "TBD - awaiting founder data (distribution 2)" },
  { totalSol: null, note: "TBD - awaiting founder data (distribution 3)" },
  { totalSol: null, note: "TBD - awaiting founder data (distribution 4)" },
];

export function getDistributionBreakdown(
  totalSol: number | null,
): Record<string, number | null> {
  if (!totalSol) {
    return RECIPIENTS.reduce((acc, r) => ({ ...acc, [r.name]: null }), {});
  }
  return RECIPIENTS.reduce((acc, r) => {
    const amount = (totalSol * r.percent) / 100;
    return { ...acc, [r.name]: Math.round(amount * 1000) / 1000 };
  }, {});
}
