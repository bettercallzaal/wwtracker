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
# Job control on, so every background job this script starts leads its own
# process group and stop can end a whole tree by group id, and nothing else.
# macOS has no setsid; this is what bash offers instead, and it is measured:
# leader pgid == its pid, children share it, one group kill ends all of them.
set -m
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
# THE GROUP A PID IS ACTUALLY IN, asked of the system rather than assumed to be
# the pid itself. A process this script starts under `set -m` leads its own
# group, so pgid == pid - but a watcher started by an earlier version of this
# script did not, and on 2026-09-22 its pidfile said 2184 while its group was
# 2172. `kill -- -2184` then failed with "no such process", stop fell through
# to killing the leader alone, and two child processes would have been left
# polling the RPC with nothing tracking them. A stop that reports success while
# leaving the work running is worse than one that fails loudly.
pgid_of() { ps -o pgid= -p "${1:-0}" 2>/dev/null | tr -d ' '; }
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
    # Rebuild when the build is not from this commit. The first version compared
    # BUILD_ID to package.json's mtime, which a pull that adds a page does not
    # touch, so it would have served a stale build with the new page missing.
    local head; head=$(git rev-parse HEAD 2>/dev/null || echo unknown)
    if [ ! -f .next/BUILD_ID ] || [ "$(cat var/built.sha 2>/dev/null)" != "$head" ]; then
      echo "building ${head:0:7} (var/build.log)..."; npm run build > var/build.log 2>&1 || { echo "BUILD FAILED, see var/build.log"; return 1; }
      echo "$head" > var/built.sha
    else echo "build is current (${head:0:7})"; fi
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

# Stop ends exactly the trees this script started, by process group. The first
# version finished with `pkill -f "next-server (v"`, which matches EVERY Next
# server on the machine. That pattern, run by hand at the end of a smoke test
# on a spare port on 2026-09-22, killed the live server on :3520 and the outage
# was reported as "died on its own"; then testing THIS fix, with the edit not
# yet applied, ran the old stop and killed it a second time. A stop that can
# hit something you did not start is not a stop.
# Ends a pid's whole process GROUP, looked up rather than assumed, and says
# what it actually did. Returns non-zero if anything in the group survives, so
# a caller is never told a stop succeeded when it did not.
stop_group() {
  local label="$1" pid="$2" g
  [ -n "$pid" ] || { echo "${label} was not running"; return 0; }
  g=$(pgid_of "$pid")
  if [ -z "$g" ]; then echo "${label}: pid ${pid} is already gone"; return 0; fi
  # NEVER GROUP-KILL OUR OWN GROUP. Demonstrated on 2026-09-22 while testing
  # this function: a process started without job control shares the caller's
  # group, and `kill -- -$g` then kills the shell running the stop, the
  # terminal it sits in, and anything else that shell started. If the pidfile
  # names something in our own group, end that process and its children only.
  local mine; mine=$(pgid_of $$)
  local n; n=$(ps -axo pgid= | tr -d ' ' | grep -c "^${g}$")
  if [ "$g" = "$mine" ]; then
    echo "${label}: pid ${pid} shares this shell's process group (${g}) - killing it and its children, not the group"
    pkill -P "$pid" 2>/dev/null
    kill "$pid" 2>/dev/null
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then echo "${label}: pid ${pid} did NOT stop"; return 1; fi
    echo "${label} stopped (pid ${pid}; its group was shared, so the group was left alone)"
    return 0
  fi
  kill -- "-$g" 2>/dev/null || kill "$pid" 2>/dev/null
  sleep 2
  if ps -axo pgid= | tr -d ' ' | grep -q "^${g}$"; then
    echo "${label}: group ${g} did NOT fully stop - still running:"
    ps -axo pid,pgid,command | awk -v g="$g" '$2==g'
    return 1
  fi
  echo "${label} stopped (group ${g}, ${n} process(es), pidfile said ${pid})"
}

cmd_stop() {
  local w; w=$(watcher_pid); local s; s=$(server_pid)
  local rc=0
  stop_group watcher "$w" || rc=1
  stop_group server "$s" || rc=1
  rm -f var/watcher.pid var/server.pid
  return $rc
}

case "${1:-}" in
  ready) cmd_ready ;;
  start) cmd_start ;;
  status) cmd_status ;;
  stop) cmd_stop ;;
  *) sed -n 2,8p "$0"; exit 2 ;;
esac
