#!/usr/bin/env bash
# The marker terminal for the 45-second window test.
#
#   scripts/ww-mark.sh                # writes to ~/zao-vault/projects/ww-45s-marks-<today>.log
#   scripts/ww-mark.sh path/to.log    # or anywhere
#
# Type a word and press Enter the moment something happens in the room:
#   announce   the host says the round is open
#   sent       Phantom confirmed your trade
#   anything else you notice
# Every line is stamped by this machine's clock, the same clock the watcher
# uses, so the marks and the chain samples can be laid side by side.
set -u
LOG="${1:-$HOME/zao-vault/projects/ww-45s-marks-$(date '+%Y-%m-%d').log}"
mkdir -p "$(dirname "$LOG")"
echo "marking to ${LOG}. Type a word, press Enter. Ctrl-C to stop."
while IFS= read -r line; do
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$line" >> "$LOG"
  echo "  marked: $(tail -1 "$LOG")"
done
