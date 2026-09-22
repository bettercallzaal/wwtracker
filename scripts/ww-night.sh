#!/usr/bin/env bash
# Battle night in one command: start, stop, status, ready.
#
#   scripts/ww-night.sh ready     # every precondition, PASS or FAIL per line, exit 1 on any FAIL
#   scripts/ww-night.sh start     # watcher (3 s polls, store var/ww-live) + built server on :3520
#   scripts/ww-night.sh status    # what is running, what it served, what it recorded
#   scripts/ww-night.sh stop      # both, cleanly
#
# Written 2026-09-21 after the recovery steps for the first quick-battle night
# were a page of commands in a vault file. A page of commands is a page of
# places to skip one. This is the page, run.
#
# It never edits .env.local and never prints a secret: a keyed RPC is shown
# only as its origin. Flags are the operator's to set; this only checks them.
set -u
cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"
PORT="${WW_PORT:-3520}"
STORE="${WW_LIVE_DIR:-var/ww-live}"
mkdir -p var

pass() { printf '  PASS  %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; FAILS=$((FAILS+1)); }
FAILS=0

# Liveness by pidfile plus a real check, never by pattern-matching the process
# table: pgrep -f matched a shell whose arguments contained the pattern and
# reported the server "already running" while :3524 answered nothing.
alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }
watcher_pid() { local p; p=$(cat var/watcher.pid 2>/dev/null || true); alive "$p" && echo "$p" || true; }
server_pid()  { local p; p=$(cat var/server.pid 2>/dev/null || true); alive "$p" && echo "$p" || true; }
http() { curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$1" 2>/dev/null || echo 000; }
server_up() { [ "$(http "http://localhost:${PORT}/")" = "200" ]; }

cmd_ready() {
  echo "ready check, $(date '+%Y-%m-%d %H:%M:%S %Z'), in ${ROOT}"
  git fetch -q origin 2>/dev/null || true
  local behind; behind=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
  if [ "$behind" = "0" ]; then pass "clone at $(git rev-parse --short HEAD), equal to origin/main"; else fail "clone is ${behind} commits behind origin/main: git pull --ff-only origin main"; fi
  for flag in WW_WIDGET WW_FINALS; do
    if grep -qE "^${flag}=1" .env.local 2>/dev/null; then pass "${flag}=1 in .env.local"; else fail "${flag}=1 missing from .env.local"; fi
  done
  if grep -qE "^SOLANA_RPC_URL=" .env.local 2>/dev/null; then pass "SOLANA_RPC_URL set in .env.local (keyed endpoint)"; else pass "SOLANA_RPC_URL not set: public endpoint (measured 2026-09-21: 165 of 165 requests answered, 0 refused, at 1.4 req/s for two minutes)"; fi
  if [ -d node_modules ] && [ -f node_modules/next/package.json ]; then pass "dependencies installed (next $(node -p "require('./node_modules/next/package.json').version"))"; else fail "node_modules missing: npm ci"; fi
  local rpc="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 -X POST -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' "$rpc" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then pass "RPC reachable (getHealth 200)"; else fail "RPC not reachable: HTTP ${code}"; fi
  if [ -n "$(watcher_pid)" ]; then pass "watcher running (pid $(watcher_pid))"; else fail "watcher not running: scripts/ww-night.sh start"; fi
  if server_up; then pass "server answering on :${PORT}"; else fail "server not answering on :${PORT}: scripts/ww-night.sh start"; fi
  local w; w=$(http "http://localhost:${PORT}/widget/1789948124")
  if [ "$w" = "200" ]; then pass "/widget/<id> is 200 (WW_WIDGET read by the running server)"; else fail "/widget/<id> is ${w}: server started without WW_WIDGET=1, or not running"; fi
  local b; b=$(http "http://localhost:${PORT}/battle/1789948124")
  if [ "$b" = "200" ]; then pass "/battle/<id> is 200"; else fail "/battle/<id> is ${b}"; fi
  local ph; ph=$(curl -s --max-time 8 "http://localhost:${PORT}/api/ww/pool-history?battleId=1789948124" 2>/dev/null | head -c 60)
  case "$ph" in *'"status":"ok"'*) pass "pool-history serves the store (${ph}...)";; *) fail "pool-history did not answer ok: ${ph:-no response}";; esac
  if [ "$FAILS" = "0" ]; then echo "READY. Open http://localhost:${PORT}/battle/latest when the first battle starts; it jumps to the newest recorded battle."; else echo "NOT READY: ${FAILS} failing"; fi
  [ "$FAILS" = "0" ]
}

cmd_start() {
  if [ -z "$(watcher_pid)" ]; then
    nohup npx tsx scripts/ww-live-watch.ts --every 3 --idle-every 10 --store "$STORE" > var/ww-live-watch.log 2>&1 &
    echo $! > var/watcher.pid
    sleep 4; echo "watcher: $(tail -1 var/ww-live-watch.log)"
  else echo "watcher already running (pid $(watcher_pid))"; fi
  if ! server_up; then
    if [ ! -d .next ] || [ "$(find .next -maxdepth 1 -name BUILD_ID -newer package.json 2>/dev/null | wc -l | tr -d ' ')" = "0" ]; then
      echo "building (var/build.log)..."; npm run build > var/build.log 2>&1 || { echo "BUILD FAILED, see var/build.log"; return 1; }
    fi
    nohup npm run start -- -p "$PORT" > var/server.log 2>&1 &
    echo $! > var/server.pid
    for _ in $(seq 1 30); do server_up && break; sleep 1; done
    echo "server: $(http "http://localhost:${PORT}/") on :${PORT}"
  else echo "server already answering on :${PORT}"; fi
  cmd_ready
}

cmd_status() {
  echo "status, $(date '+%Y-%m-%d %H:%M:%S %Z')"
  local wp; wp=$(watcher_pid); local sp; sp=$(server_pid)
  echo "  watcher: ${wp:-not running}"; [ -f var/ww-live-watch.log ] && echo "    last: $(tail -1 var/ww-live-watch.log)"
  echo "  server:  ${sp:-not running} (:${PORT} -> $(http "http://localhost:${PORT}/"))"
  echo "  store:   ${STORE}"
  for f in "$STORE"/*.jsonl; do [ -f "$f" ] || continue
    local id; id=$(basename "$f" .jsonl); local n; n=$(wc -l < "$f" | tr -d ' '); local last; last=$(tail -1 "$f" | sed -E 's/.*"t":([0-9]+).*/\1/'); local age=$(( $(date +%s) - last ))
    echo "    ${id}: ${n} samples, newest ${age}s ago"
  done
}

cmd_stop() {
  local w; w=$(watcher_pid); local s; s=$(server_pid)
  if [ -n "$w" ]; then kill "$w" && echo "watcher stopped (pid $w)"; else echo "watcher was not running"; fi
  # npm start forks next-server; kill the group the pidfile's process leads.
  if [ -n "$s" ]; then pkill -P "$s" 2>/dev/null; kill "$s" 2>/dev/null; echo "server stopped (pid $s)"; else echo "server was not running"; fi
  pkill -f "next-server \(v" 2>/dev/null || true
  rm -f var/watcher.pid var/server.pid
}

case "${1:-}" in
  ready) cmd_ready ;;
  start) cmd_start ;;
  status) cmd_status ;;
  stop) cmd_stop ;;
  *) sed -n 2,8p "$0"; exit 2 ;;
esac
