// Smoke test: verifies wavewarz.info/api/public/stats is up and returns expected shape.
// Usage: npm run smoke:stats
const STATS_URL = "https://wavewarz.info/api/public/stats";

type AnyObj = Record<string, unknown>;

function num(v: unknown): v is number { return typeof v === "number" && isFinite(v); }
function obj(v: unknown): v is AnyObj { return !!v && typeof v === "object" && !Array.isArray(v); }

async function main() {
  console.log(`GET ${STATS_URL}`);
  let data: AnyObj;
  try {
    const res = await fetch(STATS_URL);
    if (!res.ok) { console.error(`  HTTP ${res.status}`); process.exit(1); }
    data = await res.json() as AnyObj;
  } catch (e) {
    console.error(`  fetch failed: ${e}`);
    process.exit(1);
  }

  const v = data.volume as AnyObj | undefined;
  const b = data.battles as AnyObj | undefined;
  const ap = data.artistPayouts as AnyObj | undefined;
  const tc = data.traderClaims as AnyObj | undefined;
  const pr = data.platformRevenue as AnyObj | undefined;

  const checks: [string, boolean][] = [
    ["updatedAt is string", typeof data.updatedAt === "string"],
    ["solPriceUsd > 0", num(data.solPriceUsd) && (data.solPriceUsd as number) > 0],
    ["volume is object", obj(v)],
    ["volume.totalSol > 0", obj(v) && num(v.totalSol) && (v.totalSol as number) > 0],
    ["volume.last24hSol >= 0", obj(v) && num(v.last24hSol)],
    ["volume.last7dSol >= 0", obj(v) && num(v.last7dSol)],
    ["liveBattle is null or object", data.liveBattle === null || obj(data.liveBattle)],
    ["battles is object", obj(b)],
    ["battles.total > 0", obj(b) && num(b.total) && (b.total as number) > 0],
    ["battles.quickBattles >= 0", obj(b) && num(b.quickBattles)],
    ["artistPayouts.totalSol >= 0", obj(ap) && num(ap.totalSol)],
    ["traderClaims.withdrawalCount >= 0", obj(tc) && num(tc.withdrawalCount)],
    ["platformRevenue (if present): totalSol >= 0", !pr || (obj(pr) && num(pr.totalSol))],
  ];

  let passed = 0;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    if (ok) passed++;
  }

  const all = checks.length;
  console.log(`\n${passed}/${all} checks passed`);
  if (passed < all) process.exit(1);
  console.log(`volume ${(v?.totalSol as number).toFixed(3)} ◎  battles ${b?.total}  updatedAt ${data.updatedAt}`);
}

main();
