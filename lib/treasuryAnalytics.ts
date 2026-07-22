// Parse treasury CSV and compute weekly revenue analytics from real on-chain data.
// Source: public/ww-daily-treasury.csv (386 days of the fee wallet)
// "Weekly revenue" = sum of positive delta_sol (fees in). "Net weekly" = sum of all delta_sol.
// No invented numbers - only what the CSV provides.

export interface TreasuryDay {
  date: string;
  day: string;
  balance_sol: number;
  delta_sol: number;
  battles_launched: number;
  battles_launched_onchain: number;
  notes: string;
  source: string;
}

export interface WeeklyRevenue {
  week_start_date: string;
  week_end_date: string;
  gross_inflow_sol: number;
  net_flow_sol: number;
  battles_count: number;
  per_battle_fee_sol: number;
  per_battle_fee_usd: number;
}

export interface WeeklyTrend {
  weeks: WeeklyRevenue[];
  current_week: WeeklyRevenue | null;
  all_time_gross_sol: number;
  all_time_net_sol: number;
}

function parseCsv(csv: string): TreasuryDay[] {
  const lines = csv.trim().split("\n");
  const header = lines[0].split(",");
  const rows: TreasuryDay[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const delta = parts[3] ? parseFloat(parts[3]) : 0;
    const battles = parts[4] ? parseInt(parts[4], 10) : 0;

    rows.push({
      date: parts[0],
      day: parts[1],
      balance_sol: parseFloat(parts[2]),
      delta_sol: delta,
      battles_launched: battles,
      battles_launched_onchain: parts[5] ? parseInt(parts[5], 10) : 0,
      notes: parts[6] || "",
      source: parts[7] || "",
    });
  }

  return rows;
}

// Group days into weeks (Mon-Sun). Week start is the first row in that week.
function groupByWeek(days: TreasuryDay[]): Array<TreasuryDay[]> {
  if (days.length === 0) return [];

  const weeks: Array<TreasuryDay[]> = [];
  let currentWeek: TreasuryDay[] = [];

  for (const day of days) {
    const dayOfWeek = day.day.toLowerCase();
    // Monday is start of week; if we hit Monday and currentWeek is not empty, start a new week
    if (dayOfWeek === "monday" && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [day];
    } else {
      currentWeek.push(day);
    }
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

export function computeWeeklyRevenue(solPrice: number): {
  weeks: WeeklyRevenue[];
  current_week_last_7_days: WeeklyRevenue | null;
} {
  // Fetch CSV from public/ww-daily-treasury.csv
  // This is a client-side parse for now; in real use, read from the file at build/fetch time
  const csvUrl = "/ww-daily-treasury.csv";

  // Return a function that fetches and parses
  return {
    weeks: [],
    current_week_last_7_days: null,
  };
}

// Server-side version: parse CSV text directly
export function parseWeeklyRevenueFromCsv(
  csvText: string,
  solPrice: number,
): WeeklyTrend {
  const days = parseCsv(csvText);
  if (days.length === 0) {
    return {
      weeks: [],
      current_week: null,
      all_time_gross_sol: 0,
      all_time_net_sol: 0,
    };
  }

  const weeks = groupByWeek(days);
  const weeklyRevenues: WeeklyRevenue[] = [];

  let allTimeGrossSol = 0;
  let allTimeNetSol = 0;

  for (const week of weeks) {
    const grossInflow = week.reduce((sum, day) => sum + Math.max(0, day.delta_sol), 0);
    const netFlow = week.reduce((sum, day) => sum + day.delta_sol, 0);
    const battlesCount = week.reduce((sum, day) => sum + day.battles_launched, 0);
    const perBattleFeeSol = battlesCount > 0 ? grossInflow / battlesCount : 0;

    allTimeGrossSol += grossInflow;
    allTimeNetSol += netFlow;

    weeklyRevenues.push({
      week_start_date: week[0].date,
      week_end_date: week[week.length - 1].date,
      gross_inflow_sol: grossInflow,
      net_flow_sol: netFlow,
      battles_count: battlesCount,
      per_battle_fee_sol: perBattleFeeSol,
      per_battle_fee_usd: perBattleFeeSol * solPrice,
    });
  }

  // Current week is the last week
  const currentWeek = weeklyRevenues.length > 0 ? weeklyRevenues[weeklyRevenues.length - 1] : null;

  return {
    weeks: weeklyRevenues,
    current_week: currentWeek,
    all_time_gross_sol: allTimeGrossSol,
    all_time_net_sol: allTimeNetSol,
  };
}

// Client-side hook to load CSV and compute weekly revenue
export async function loadWeeklyRevenueFromCsv(solPrice: number): Promise<WeeklyTrend> {
  try {
    const res = await fetch("/ww-daily-treasury.csv");
    if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
    const csvText = await res.text();
    return parseWeeklyRevenueFromCsv(csvText, solPrice);
  } catch (err) {
    console.error("Error loading weekly revenue:", err);
    return {
      weeks: [],
      current_week: null,
      all_time_gross_sol: 0,
      all_time_net_sol: 0,
    };
  }
}
