# Watching /live through the Grand Final

**13 September 2026.** `/live` has only ever been watched on settled battles with
zero holders. A main event is the first time it carries real positions, the first
time anyone is looking while it does, and the first time our own tooling can take
it down by competing for the same RPC budget.

    npm run watch:live          # loop every 60s, macOS notification on warn+
    npm run watch:live:once     # single check, exit code is the severity

## Where the alert lands - read this before relying on it

| Channel | Reaches | Caveat |
|---|---|---|
| **stdout** | whoever is looking at the terminal | one line per check, **including healthy ones** |
| **`var/live-watch.log`** | anyone, afterwards | appended, gitignored |
| **exit code** | a cron, a supervisor | `0` ok, `1` info, `2` warn, `3` alert |
| **macOS notification** | this machine | `--notify`, and only while it is awake and logged in |

**It does not reach a phone, a channel, or anybody away from this machine.** If
it needs to, that is a delivery decision with credentials attached, and it is
Zaal's to make rather than something to assume. Saying so matters more than the
gap does: a monitor nobody sees is worse than no monitor, because it creates the
belief that somebody is watching.

**Why the healthy line is printed too.** A watcher that only speaks up when
something is wrong is silent through its own crash, and silence reads exactly
like everything being fine. The heartbeat is the point: if the lines stop, the
watcher died.

## What it wakes you for, and what it does not

| Code | Level | Why it is on the list |
|---|---|---|
| `UNKNOWN` | alert | Chain is unreadable. **Arrives inside a 200**, so anything checking HTTP status alone sees nothing wrong |
| `UNAUTHORIZED` | alert | The RPC rejected our credential |
| `RATE_LIMITED` | alert | Our RPC budget is exhausted. **Read the note below before assuming the page is broken** |
| `HTTP_ERROR` | alert | Non-200, which our contract says never happens - so this is our deployment, not chain |
| `UNREACHABLE` | alert | Nothing answered at all |
| `UNPARSEABLE` | alert | 200 with a body that is not an object |
| `STALE` | warn | Serving a cached body, with its age |
| `SLOW` | warn | Over 4s to first byte. The interesting signal precedes the outage |
| `TRUNCATED` | info | A side hit the 20-holder read cap |
| `NOT_RUNNING` | info | No battle in progress. Normal between battles, which is why it is info |
| `OK` | ok | Heartbeat |

`TRUNCATED` is worth explaining. The most holders any side has ever ended with is
**18**, measured across all 1,643 battles, and `getTokenLargestAccounts` returns
at most 20. The Grand Final is the most likely event in the platform's history to
be the first to trip it. It is not a failure - but if it fires, the holder counts
on the page have quietly become lower bounds, and somebody should know that while
it is happening rather than afterwards.

## Key rotation does not break it

The watcher reads **nothing** about the RPC endpoint or its key. It probes our
own public endpoint, which resolves `SOLANA_RPC_URL` server-side at request time.
So a rotation cannot break the watcher, and a *botched* rotation is precisely
what it is built to catch - reported as `UNAUTHORIZED` rather than as a generic
failure, so the operator is told which thing broke.

## The key is knowingly disclosed through the 13th

`/api/ww/positions` published `SOLANA_RPC_URL` - a keyed endpoint - in its own
`source` field from 2026-09-06 until PR #245 closed it. The leak is fixed. The
key is not rotated.

**That is a decision, not an oversight.** Zaal's call on the evening of
2026-09-07: rotate *after* the Grand Final, not before, because that key's budget
is the only thing keeping `/live` up and a rotation going wrong during the event
is the worse risk. Recorded in `decisions/grill-2026-09-07-evening.md`.
**Re-raise on 2026-09-14, not before.**

So for six days the key is disclosed and live, deliberately. What that means for
whoever is watching on the night:

**If `RATE_LIMITED` fires, do not assume the page is broken.** A disclosed key
being used by somebody else does not look like a rejected credential - it looks
like our own budget disappearing. That is why it has its own code rather than
folding into `UNKNOWN`. The response is different too: nothing about the
deployment needs fixing, and the fix is rotating the key, which is exactly the
thing being deferred.

`UNAUTHORIZED` firing before the 14th would mean something else entirely - the
key revoked or the endpoint changed underneath us - because no rotation is
scheduled to happen during the event.

## It probes the page as well as the route

They fail independently. `/api/ww/positions` can be perfectly healthy while
`/live` fails to render, because the page is a client component and its bundle,
its shell or its deploy can break on their own. A viewer only ever sees the page.

| Code | Level | |
|---|---|---|
| `PAGE_UNREACHABLE` | alert | nothing answered |
| `PAGE_ERROR` | alert | non-200 |
| `PAGE_BROKEN` | alert | **200, but the body is not the page** |
| `PAGE_SLOW` | warn | over 4s to first byte |
| `PAGE_OK` | ok | heartbeat |

`PAGE_BROKEN` is the one worth having. A 200 is not a rendered page - a
single-page-app catch-all will happily answer 200 for a route that does not
exist, which is how a sibling lane nearly concluded an endpoint was live today.
The check is the server-rendered `<title>`, not the holder tables: those are
client-side and legitimately absent from the HTML, and a watcher that cries wolf
every cycle is one nobody reads on the night it matters.

## Running it unattended

**Merging a watcher is not watching.** Nothing starts it for you.

    ./scripts/install-live-watch.sh          # launchd agent, every 60s
    ./scripts/install-live-watch.sh --uninstall

launchd keeps it alive across terminal closes and logins, which a `npm run
watch:live` in a tab does not. Verify it rather than trusting the installer's
own success message:

    launchctl list | grep wwtracker
    tail -f var/live-watch.log

Or just keep a terminal open:

    npm run watch:live 2>&1 | tee -a var/live-watch.log

**It does not run while the machine is asleep.** A laptop shut at 9pm is a
watcher that is not running, and the log will look exactly like a quiet night.
If the Grand Final needs coverage while nobody is at this machine, the answer is
a hosted check, not this - and that is a decision with credentials attached.

Simplest, in a terminal that stays open:

    npm run watch:live 2>&1 | tee -a var/live-watch.log

Or on a schedule, keying on the exit code so info-level gaps between battles do
not page anybody:

    * * * * * cd /path/to/wwtracker && node scripts/live-watch.mjs --notify \
      >> var/live-watch.log 2>&1 || true

**The machine has to be awake.** A laptop asleep at 9pm is a watcher that is not
running, and it will look exactly like a quiet night.

## Verified

The classifier has a test per alert state. The runner itself was exercised
against three real targets rather than assumed:

    node scripts/live-watch.mjs                              INFO  NOT_RUNNING       exit 1
                                                             OK    PAGE_OK
    node scripts/live-watch.mjs --url .../api/ww/nope        ALERT HTTP_ERROR        exit 3
    node scripts/live-watch.mjs --url http://127.0.0.1:9/x   ALERT UNREACHABLE       exit 3
    node scripts/live-watch.mjs --page .../api/ww/stats      ALERT PAGE_BROKEN       exit 3
    node scripts/live-watch.mjs --page .../nope-not-a-page   ALERT PAGE_ERROR        exit 3
    node scripts/live-watch.mjs --page http://127.0.0.1:9/x  ALERT PAGE_UNREACHABLE  exit 3
