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
# of idle - currently held off only by sixteen `caffeinate` processes belonging
# to other lanes. If those stop, the machine sleeps in a minute and the watcher
# dies with it.
#
# So each run is wrapped in `caffeinate -s`, which holds off system sleep for the
# duration of that probe rather than relying on somebody else's process. It does
# NOT keep the machine awake between runs, and it cannot help if the lid is shut.
# For coverage with nobody at this machine the answer is still a hosted check.
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

mkdir -p "$HOME/Library/LaunchAgents" "$REPO/var"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-s</string>
    <string>$NODE</string>
    <string>$REPO/scripts/live-watch.mjs</string>
    <string>--notify</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartInterval</key><integer>$EVERY</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$REPO/var/live-watch.log</string>
  <key>StandardErrorPath</key><string>$REPO/var/live-watch.err</string>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "installed $LABEL, every ${EVERY}s"
echo
echo "Verify it is actually running, rather than trusting this message:"
echo "  launchctl list | grep wwtracker"
echo "  tail -f $REPO/var/live-watch.log"
echo
echo "It will not run while this machine is asleep."
