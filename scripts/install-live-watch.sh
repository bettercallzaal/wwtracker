#!/usr/bin/env bash
# Turn the watcher from a merged script into something that is actually running.
#
#   ./scripts/install-live-watch.sh            install, every 60s
#   ./scripts/install-live-watch.sh --every 30
#   ./scripts/install-live-watch.sh --uninstall
#
# Merging a watcher is not watching. This installs a launchd agent so it keeps
# running across terminal closes and logins, which a `npm run watch:live` in a
# tab does not.
#
# It is NOT run automatically and nothing installs it for you - a background job
# on somebody's machine is theirs to opt into.
#
# THE LIMIT, said plainly: launchd does not run while the machine is asleep. A
# laptop shut at 9pm is a watcher that is not running, and the log will look
# exactly like a quiet night.
#
# Measured 2026-09-08: `pmset -g` reports `sleep 1` on this machine - one minute
# of idle - currently held off only by other lanes' `caffeinate` processes.
#
# A `caffeinate -s` wrapper WAS added here for that, and it was wrong twice over.
# It BREAKS the job: under launchd, with caffeinate in ProgramArguments the
# process starts, holds its file descriptors, sits in uv__io_poll and never
# produces output. Removing it - same plist, same log paths, same everything -
# and the job runs and writes in under twenty seconds. Measured both ways.
#
# It also never solved the problem it was added for. It would hold sleep off for
# the one second a probe runs, and do nothing for the fifty-nine seconds between
# probes, which is when the machine would actually sleep.
#
# So: no wrapper. If the machine sleeps, the watch stops, and the honest answer
# for coverage with nobody present is a hosted check.
#
# RE-CHECK BY 2026-09-13: run `pmset -g` again before the Grand Final. This
# reasoning is only as good as that setting.
set -euo pipefail

LABEL="com.zao.wwtracker.livewatch"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EVERY=60

while [ $# -gt 0 ]; do
  case "$1" in
    --every) EVERY="$2"; shift 2 ;;
    --uninstall)
      launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
      rm -f "$PLIST"
      echo "uninstalled $LABEL"
      exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

NODE="$(command -v node)"
if [ -z "$NODE" ]; then echo "node not found on PATH" >&2; exit 1; fi

LOGDIR="$HOME/.zao/logs"
mkdir -p "$HOME/Library/LaunchAgents" "$LOGDIR"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$REPO/scripts/live-watch.mjs</string>
    <string>--notify</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartInterval</key><integer>$EVERY</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOGDIR/live-watch.log</string>
  <key>StandardErrorPath</key><string>$LOGDIR/live-watch.err</string>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

# VERIFY BY OUTCOME. The installer used to print "installed" and stop, which was
# worthless: launchd will happily load a job that cannot run, `launchctl list`
# shows it, and the only symptom is silence. That is how this shipped broken -
# logs pointed under ~/Desktop, which is TCC-protected, so launchd could not open
# stdout/stderr and exited 78 EX_CONFIG with an empty stderr, because stderr was
# the thing that failed.
echo "bootstrapped $LABEL, every ${EVERY}s - now proving it actually runs"
: > "$LOGDIR/live-watch.log"
launchctl kickstart -p "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true

for _ in $(seq 1 20); do
  [ -s "$LOGDIR/live-watch.log" ] && break
  sleep 1
done

if [ -s "$LOGDIR/live-watch.log" ]; then
  echo "VERIFIED: the agent ran and wrote output."
  sed 's/^/  /' "$LOGDIR/live-watch.log" | tail -2
else
  code=$(launchctl print "gui/$(id -u)/$LABEL" 2>/dev/null | sed -n 's/.*last exit code = \(.*\)/\1/p' | head -1)
  echo "FAILED: the agent is loaded but produced no output. last exit code: ${code:-unknown}" >&2
  echo "  78/EX_CONFIG means launchd could not open its log paths - check $LOGDIR is writable" >&2
  echo "  stderr: $(tail -3 "$LOGDIR/live-watch.err" 2>/dev/null || echo '(empty, which is itself the symptom)')" >&2
  exit 1
fi

echo
echo "  logs:      $LOGDIR/live-watch.log"
echo "  status:    launchctl print gui/$(id -u)/$LABEL | grep 'last exit'"
echo "  uninstall: $0 --uninstall"
echo
echo "It will not run while this machine is asleep."
