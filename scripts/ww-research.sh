#!/usr/bin/env bash
# Regenerate the WaveWarZ on-chain analytics snapshot (lib/wwData.ts).
# Requires DUNE_API_KEY in the environment. Reuses one scratch Dune query,
# runs each dataset, writes /tmp/ww-<name>.json. Then run scripts/ww-gen.py.
set -euo pipefail
: "${DUNE_API_KEY:?set DUNE_API_KEY}"
QID="${WW_SCRATCH_QUERY_ID:-7722263}"
PROG="9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo"
DEV="FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37"
TRADER="4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk"
H=(-H "x-dune-api-key: $DUNE_API_KEY" -H "Content-Type: application/json")

run() {
  local name="$1" sql="$2" eid state i
  curl -s -X PATCH "https://api.dune.com/api/v1/query/$QID" "${H[@]}" \
    -d "$(python3 -c "import json,sys;print(json.dumps({'query_sql':sys.argv[1]}))" "$sql")" >/dev/null
  eid=$(curl -s -X POST "https://api.dune.com/api/v1/query/$QID/execute" "${H[@]}" -d '{}' \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('execution_id',''))")
  for i in $(seq 1 80); do
    state=$(curl -s "https://api.dune.com/api/v1/execution/$eid/status" "${H[@]}" \
      | python3 -c "import sys,json;print(json.load(sys.stdin).get('state',''))")
    [ "$state" = "QUERY_STATE_COMPLETED" ] && break
    [ "$state" = "QUERY_STATE_FAILED" ] && break
    sleep 6
  done
  echo "[$name] $state" >&2
  curl -s "https://api.dune.com/api/v1/execution/$eid/results?limit=5000" "${H[@]}" > "/tmp/ww-$name.json"
}

run daily "SELECT block_date, count(distinct tx_id) AS txs, count(distinct tx_signer) AS traders FROM solana.instruction_calls WHERE executing_account='$PROG' AND block_date >= date '2025-08-01' GROUP BY 1 ORDER BY 1"
run traders "SELECT tx_signer AS trader, count(distinct tx_id) AS txs FROM solana.instruction_calls WHERE executing_account='$PROG' AND block_date >= date '2025-08-01' GROUP BY 1 ORDER BY 2 DESC LIMIT 50"
run pnl "WITH ww AS (SELECT distinct tx_id FROM solana.instruction_calls WHERE executing_account='$PROG' AND tx_signer='$TRADER' AND block_date >= date '2025-08-01') SELECT aa.block_time, aa.balance_change/1e9 AS sol_delta FROM solana.account_activity aa JOIN ww ON aa.tx_id = ww.tx_id WHERE aa.address='$TRADER' ORDER BY aa.block_time"
run devflow "SELECT block_date, sum(case when balance_change>0 then balance_change else 0 end)/1e9 AS inflow, sum(case when balance_change<0 then -balance_change else 0 end)/1e9 AS outflow, sum(balance_change)/1e9 AS net FROM solana.account_activity WHERE address='$DEV' GROUP BY 1 ORDER BY 1"
echo "done - now regenerate lib/wwData.ts from /tmp/ww-*.json" >&2

# lifetime buy-side SOL volume (updates public/ww-lifetime.json - run from a Dune plan with raw Solana datasets)
run lifetime "WITH ww AS (SELECT DISTINCT tx_id FROM solana.instruction_calls WHERE executing_account='$PROG' AND block_date >= date '2025-05-01') SELECT SUM(CASE WHEN aa.balance_change<0 THEN -aa.balance_change ELSE 0 END)/1e9 AS lifetime_sol FROM solana.account_activity aa JOIN ww ON aa.tx_id=ww.tx_id WHERE aa.tx_signer=aa.address"
