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
| **macOS notification** | this machine | `--notify`, and only while it is awake and logged in. **Never fired before 2026-09-10** - see Verified |
| **GitHub failed-run email** | the account that last changed the cron | the hosted check below, alerts only. **MEASURED 2026-09-12: it does NOT arrive** (run `34714552200` failed and nothing came). **REPORTED, not verified here:** the cause is that no email or GitHub Mobile notification is configured. See below |

**The local watcher does not reach a phone, a channel, or anybody away from this
machine.** The hosted check is the one path that can, and it needed no new
credential - the earlier line here, that any such path was "a delivery decision
with credentials attached", was wrong for this one. Saying where an alert lands
matters more than the gap does: a monitor nobody sees is worse than no monitor,
because it creates the belief that somebody is watching.

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
`source` field from 2026-09-06 until PR #245 closed it. The leak is fixed. **The
disclosed key has not been deleted.**

*(Corrected 2026-09-10. This said "the key is not rotated", while
`docs/RECHECK.md` says it was rotated on 2026-09-08 with the old key left live,
and this lane's own status says "closed, rotated, `/live` restored". RECHECK's
version has the more specific evidence, so that is the one this now follows.
The deletion is what is deferred. This also cited
`decisions/grill-2026-09-07-evening.md`, which has no mention of a key, an RPC or
a rotation. The call is recorded in the vault at
`handoffs/archive/MORNING-2026-09-08.md`: "Rotation is deferred past the 13th by
your own call".)*

**That is a decision, not an oversight.** Zaal's call on 2026-09-07: finish the
rotation *after* the Grand Final, not before, because that budget is what keeps
`/live` up and a rotation going wrong during the event is the worse risk.
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

## Retry before alarming - one failure is weather

Every probe retries up to **3 times over about 10 seconds** and stops as soon as
one comes back clean. Only a sustained failure alarms, and the message says how
many attempts it took: `[3/3 attempts failed]`.

This is borrowed rather than invented. A monitor two lanes over fired an alarm on
a single failed curl, the thing self-healed inside two minutes, and the recovery
spent a second alarm. Two pages for something that was never broken is how people
learn to ignore a pager.

**A recovery is still reported**, at info, as `FLAPPED`. A watcher that hides
flapping is only a slower version of the same problem - the goal is not to be
quiet, it is to be quiet about the right things. If `FLAPPED` starts repeating,
that is a signal in itself.

Tune with `--attempts` and `--gap` if the night calls for it.

## An unreadable state is never healthy

`UNRECOGNISED_STATUS` alerts whenever the body's `status` is missing, renamed, or
anything other than `live`, `stale` or `unknown`.

That rule exists because this watcher had the opposite behaviour until
2026-09-08. A 200 with no `status` field and `data: null` classified as
**"ok: live"** - the less the response said, the healthier it looked. It was
found by testing the classifier rather than reading it, and it is the same
inverted alarm as the spend guard in a different costume: the failure mode of a
monitor is silence, and silence is indistinguishable from fine.

Every message also carries the HTTP status, including the healthy one, so a
silent flip to a 404 or a proxy error page reads as `HTTP 404` rather than as an
unexplained blob.

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

## The unattended path works - and finding out why it did not is the lesson

**Measured 2026-09-08 by actually running the installer**, which had never been
executed - only `bash -n` syntax-checked, which proves nothing about behaviour.

Two defects, both now fixed, and the second one was mine twice over.

**Logs were under `~/Desktop`, which is TCC-protected.** launchd could not open
stdout or stderr there, so the job exited **78 / EX_CONFIG** with an *empty
stderr* - because stderr was the thing that failed. The installer printed
"installed", `launchctl list` showed the job, and it had never run. On the night
that is indistinguishable from a quiet evening. Logs now go to `~/.zao/logs`.

**`caffeinate -s` in `ProgramArguments` broke the job.** With it, the process
starts, holds its file descriptors, sits in `uv__io_poll` and never produces
output. Remove it - same plist, same paths, same everything - and it runs and
writes in under twenty seconds. Measured both ways.

It was also solving the wrong problem. It held sleep off for the one second a
probe runs and did nothing for the fifty-nine seconds between probes, which is
when a machine actually sleeps. I added it as a "decision made rather than
asked"; it was the wrong decision, and only running the thing found that.

So: **no wrapper.** If the machine sleeps the watch stops, and the honest answer
for coverage with nobody present is a hosted check.

**The installer verifies instead of asserting.** It truncates the log, kickstarts
the job, waits, and fails loudly with the exit code and an EX_CONFIG hint if
nothing appears. Verified end to end - it reported VERIFIED with real output, and
the first line it caught was a genuine `PAGE_SLOW` at 4961ms.

**RE-CHECKED 2026-09-13 04:31Z: the installer still verifies, and NOTHING IS INSTALLED.**
`launchctl list` shows no `live-watch` job loaded on this machine, and the newest line in
`var/live-watch.log` is 2026-09-12T22:13:49Z - a manual smoke test, not a scheduled run.

So on the night this file was written for, the local watcher is not watching. That is the
section heading below stated as a measurement rather than a warning: **merging a watcher is
not watching, and neither is verifying its installer.** The installer was proven to work
once, which is a different claim from the job being loaded now, and only the second one
watches anything.

Consequence for tonight, stated where it is read: **the hosted dispatch is the only probe
running**, and the local path contributes nothing regardless of what `pmset` says.

**RE-CHECK BY 2026-09-14.**

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

**Sleep, measured rather than assumed.**

| Measured | `sleep` | Held off by |
|---|---|---|
| 2026-09-08 | `1` (one minute of idle) | sixteen `caffeinate` processes, all other lanes' |
| 2026-09-10 14:17Z | `1` | five `caffeinate` processes, **each asserting for 300 seconds** at a time, plus `powerd` while the display is on |

The setting has not moved and the thing holding it off is thinner than it looked:
a five-minute assertion that some other process keeps renewing. If nobody is
working on the night, this machine sleeps a minute after the last one lapses and
takes the watcher with it.

*(An earlier version of this paragraph said each run was wrapped in
`caffeinate -s`. That wrapper was removed - see the section above - and this
paragraph kept describing it for two days. Same defect class as everything else
the 2026-09-09 sweep found: a correction that reached one reader and not the
next.)*

So a laptop watcher is a best effort, and the coverage with nobody present is the
hosted check below.

**RE-CHECKED 2026-09-13 04:30Z, and the `sleep 1` figure was reading one profile as
though it were the setting.** `pmset -g` reports the ACTIVE power source only. Read
per profile with `pmset -g custom`:

    Battery Power    sleep 1     one minute of idle, as recorded
    AC Power         sleep 0     never idle-sleeps, displaysleep 0 as well

So the local watcher's fragility is **conditional on the power source**, not a property
of the machine. On AC it survives an unattended night; on battery it dies about a minute
after the last `caffeinate` assertion drops. The active reading at 04:30Z was
`sleep 0 (sleep prevented by powerd, AddressBookSourceSync, caffeinate)`, which is the
AC profile plus three assertions - and quoting that alone would have been just as
misleading in the opposite direction.

Same shape as the other figures corrected this week: a number that is correct under one
denominator and silently wrong under another. The honest statement is "1 minute on
battery, never on AC", and neither half stands alone.

**RE-CHECK BY 2026-09-14**, after the final, and read `pmset -g custom` rather than
`pmset -g`.

## The hosted check - coverage when this Mac is asleep

`.github/workflows/live-watch.yml` runs the same probe from GitHub: hourly on
11-12 September to prove the schedule fires, then **every five minutes from
20:00 ET on the 12th to 03:55 ET on the 14th**. The start time of the final is
not in any file this lane can read, so the window is the whole day.

It needs **no new credential**. It reads our own public endpoints, and GitHub
reports a *failed* scheduled run to the account that last changed its cron. It
fails on `ALERT` only - `NOT_RUNNING` between battles and `SLOW` / `STALE` pass
with an annotation - so the only email is one worth reading. During a sustained
outage that is one email per five-minute run, which on this night is the point.

**MEASURED 2026-09-12, AND THE ANSWER IS NO: the alert does not reach a phone as
configured.** The test was run - dispatch `34714552200` at 19:34:30Z against
`/nope`, which failed exactly as designed with `ALERT HTTP_ERROR` and
`ALERT PAGE_ERROR`, both at 3/3 attempts, `exit 3`. **The run failed and nothing
arrived.** That much is measured here. **The cause is REPORTED and not verified here:**
GitHub delivers a failed-run alert by email or through the GitHub Mobile app, and the
dotfiles lane, which has the account in front of it, reports neither is set up - so the
notification had nowhere to go.

**What that changes, and it is not small: the hosted watch currently has no output.**
Every probe below can fire on time and a real outage still reaches nobody. The two
halves of this path fail independently - the run failing is measured and works, the
delivery is measured and does not - and a green run history says nothing about the
second. That is the whole reason this line was written as UNMEASURED rather than
assumed, and it turns out to have been the half that was broken.

**Reported to this lane by the dotfiles lane, which has the account in front of it;
not independently verified here**, because notification settings are not readable
through the API. What IS verified here is the first half: the run failed, with the
log lines above.

**Until the account has email or GitHub Mobile notifications enabled, the dispatched
loop is not the primary coverage - it is the only coverage, and it is silent too.**
A dispatched run that fails alerts through the same path. Someone has to watch the
run itself.

The test to repeat once notifications are on, because a fix is not a measurement:
Actions, `live-watch`, Run workflow, `base` = `https://wwtracker.vercel.app/nope`.
Both probes 404, the run fails, and the notification either arrives or it does not.
Measured locally 2026-09-10: that input produces `HTTP_ERROR` + `PAGE_ERROR` and
fails the step; the real base passes with `NOT_RUNNING` + `PAGE_OK`.

**Do not rely on the schedule. Measured 2026-09-11, it is hours late or absent.**
The line that stood here said GitHub's cron "can run late" and called five
minutes the ceiling on resolution. Both undersold it:

| Schedule | Set for | Actually fired |
|---|---|---|
| `checks.yml`, daily | 08:30 UTC | 12:14 - 14:21 UTC, every day for five days: **4-6 hours late** |
| this workflow, hourly on the 11th | 00:17, 01:17 UTC | **no run at all** as of 01:29 UTC |

**Re-measured 2026-09-12 21:0x UTC, with 45 hourly slots now elapsed, and it is
worse than "late" - the cadence is not hourly at all.** Eleven scheduled runs fired in
those 45 slots, a **24.4%** fire rate, and the ten gaps between consecutive runs sum to
38.71 hours - mean 3.87, median 4.20, longest 5.05, shortest 2.18:

    the cron asks for            one run per hour
    the effective cadence is     one run per 3.9 hours (median 4.2)

That is not jitter around an hourly schedule, it is a different schedule. Every one
of the eleven passed, so nothing looks wrong from the outside. (Superseded the
13:4x measurement of nine runs in 38 slots, 23.7%, which the extra seven hours barely
moved.)

**MEASURED 2026-09-13 01:43 UTC, and it is worse than either projection: the `*/5`
window has delivered ZERO runs in its first 1h43m.** It promised 20 in that span, and 12
in the first hour alone.

| | Runs |
|---|---|
| What `*/5 * 13 9 *` promised by 01:43Z | 20 |
| **Actually fired** | **0** |
| Projected here beforehand, fixed-cadence model | 0 to 1 in the first hour |
| Projected here beforehand, fixed-fraction model | about 3 in the first hour |

**The fixed-cadence model was right and the fraction model is dead.** GitHub delivers
roughly one scheduled run per repository per several hours whatever the cron asks for; it
does not drop a constant fraction. Across an eight-hour final window that is about **2
probes, not 23**. (The two projections are kept above rather than deleted, because which
one survived is the useful part; a table that only shows the winner teaches nobody.)

**AND THE HARDER FACT, which the probe count obscures: the hosted watch has been DARK
since 00:00Z.** The hourly cron is scoped `17 * 11-12 9 *` - days 11 and 12 only - so it
stopped at the end of the 12th. From 00:00Z on the 13th, `*/5` is the ONLY schedule, and
it has produced nothing. Last scheduled run of any kind: **23:59:53Z on the 12th.** So
the transition into the intensive window is a transition into no coverage at all, and
nothing about it looks broken from the outside - the workflow is `active`, the cron is
valid, and the run history simply stops.

Checked before concluding, so this is not a config fault being read as a scheduler fault:
the cron on main is `*/5 * 13 9 *`, `gh workflow view` reports `active`, and a dispatched
run on the same file worked minutes earlier.

**Updated 02:55Z, and the wording matters: the window has now CREATED one run and still
EXECUTED none.** Run `34734100789` was created 02:52:17Z - the first in 2h52m of a cron
asking for 34 - and it is `pending`, not running.

**It is queued behind the dispatched loop, because both share one `concurrency` group.**
`group: live-watch` with `cancel-in-progress: false` is what makes two dispatches chain
instead of racing, and it applies to scheduled runs too. So while a 340-minute dispatch
holds the group, scheduled probes queue rather than run:

    a long dispatch is running   ->  a scheduled run is created and waits
    another run joins the group  ->  the WAITING one is CANCELLED, not kept
    the dispatch ends            ->  whatever is still queued starts, probing the site as it is THEN

**Corrected 07:00Z: a queued run is cancelled when another joins the group, not kept.**
This section first said scheduled runs "queue behind" the dispatch. Measured: scheduled run
`34734100789` sat pending from 02:52:17Z and its conclusion is **`cancelled`, updated
07:00:02Z** - the same second a second dispatch was created. So `cancel-in-progress: false`
protects a RUNNING run only; GitHub keeps at most one pending run per group and discards the
older one. The schedule therefore contributes nothing at all while a dispatch is up, which is
stronger than "it waits its turn".

That is the right trade during the final - the dispatch probes every 60 seconds, far
better than the schedule ever offered - but two things follow. **A "pending" run is not
coverage**, so counting created runs would overstate what is watching. And a run that
queues for hours reports on the moment it finally starts, not the moment it was due, so
its timestamp describes the queue and not the site.

The count that matters is therefore runs EXECUTED in the window, and while a dispatch is
up that number is zero by design rather than by scheduler failure.

**MEASURED 07:45Z, the dispatched path against the same eight hours: it delivers exactly what
it promises.** Run `34731726081` ran its full 340 minutes and completed `success`. Its log:

    340   INFO  NOT_RUNNING     one probe per minute, no drift
    340   OK    PAGE_OK         /live rendered 200 on every one
      0   WARN or ALERT         nothing to report across 5h41m
    01:55:27Z first probe, 07:36:00Z last

So the comparison is not close, and it is now measured on both sides rather than projected on
one: **340 probes from one dispatch against about 2 from the schedule over a comparable
window.** A deadline loop inside a single job is two orders of magnitude better than asking
GitHub's scheduler for the same coverage, because it asks once.

One more thing that log says, which no count of runs would: **no battle was running for the
entire 5h41m.** Every probe returned `NOT_RUNNING`. A watch is only as informative as the
period it covers, and this one covered a quiet stretch - which is a fact about the night, not
a fact about the watcher, and worth separating from "the watcher reported nothing wrong".

**And the missing runs were never CREATED, which rules out the obvious alternative.** The
dotfiles lane suggested the pattern might be GitHub creating a run per slot and failing to
allocate a runner - which would look identical from a completed-run count, and would mean
both models here are measuring the wrong variable. It is testable and it does not hold:

    runs ever created for this workflow, all time     17
    hourly slots elapsed 11-12 September alone        45
    runs in any state other than completed, ever       2   (today's dispatch and its queued run)

Seventeen total against forty-five slots plus a five-minute window. If slots were being
created and left unallocated, `gh run list` would show dozens or hundreds of `queued` runs,
historically and now. There are two, both from today, both explained. **So GitHub declines to
create the run at all** - the throttle is at scheduling, not at runner allocation, and the
effective-cadence model stands.

Worth keeping as a method note rather than only a result: the distinction is invisible in a
count of completed runs, and the way to separate them is the TOTAL created count, which no
amount of staring at the successful runs would have produced.

**The decision does not wait on that, because both models give the same answer.** 2 or 23,
a five-minute schedule delivering a probe every 20 minutes at best - and running hours
late at worst - watches the final after it ends. So the dispatched loop below is not a
belt-and-braces addition to the schedule; it is the coverage. The schedule is decoration
that costs nothing.

**The path to rely on is a dispatched loop.** Started by hand, it probes every
60 seconds for up to 340 minutes and fails - which is what sends the email - at
the first sustained `ALERT`. It does not wait on the scheduler:

    gh workflow run live-watch.yml -R bettercallzaal/wwtracker -f minutes=340

Start it within the hour before the final begins; 340 minutes covers a
five-and-a-half-hour window. Measured locally: `minutes=1` against the real site
runs two probes and passes in 64s; against `/nope` it fails on the first probe
in 8s. The schedule stays as a backup that costs nothing on a public repo.

**Two dispatches CHAIN, so the timing does not have to be precise.** The
`concurrency` block uses one group with `cancel-in-progress: false`, which means a
second dispatch does not race the first and is not discarded - it sits pending and
starts when the first finishes. So firing it twice gives about **11 hours 20 minutes
of unbroken 60-second probing**, back to back, with no gap to time:

    gh workflow run live-watch.yml -R bettercallzaal/wwtracker -f minutes=340
    gh workflow run live-watch.yml -R bettercallzaal/wwtracker -f minutes=340

That matters because 340 minutes is the ceiling per run - the job's `timeout-minutes`
is 350 and the script caps `minutes` at 340 - so a single dispatch started an hour
early runs out an hour early. Two removes the guesswork: start them whenever, well
before the final, and the window covers the whole evening either way. The only cost
is Actions minutes on a public repo, which are free.

Do NOT try to raise `minutes` above 340 to get the same effect. The cap exists
because the deadline loop must end inside the job timeout; a longer value is clamped,
so it would silently give the same 340 while reading as more.

## Other ways to run it locally

Simplest, in a terminal that stays open:

    npm run watch:live 2>&1 | tee -a var/live-watch.log

Or on a schedule. `--notify` only posts on warn and alert, so info-level gaps
between battles do not page anybody:

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

**None of those passed `--notify`, and `--notify` was broken.** Found
2026-09-10: the notification path called `require()` inside an ES module, where
it does not exist. The `ReferenceError` landed in a catch written so a failed
notification could never stop the watcher - so it never stopped the watcher, and
never posted anything either. `npm run watch:live`, the command at the top of
this file, passes `--notify`. Every alert it would have raised on this machine
was printed to a terminal and nowhere else.

Fixed by importing `spawnSync` at the top, and a failed notification now prints
`notify FAILED` instead of vanishing. Verified: an `UNREACHABLE` alert with
`--notify` spawns `osascript`, which exits 0 (on-screen display not observed -
nobody was at the machine). `lib/__tests__/esmRequire.test.ts` scans every
tracked `.mjs` for the same defect and fails on the pre-fix file.

**That guard only covers one way of breaking.** `lib/__tests__/liveWatchNotify.test.ts`
is the test that fails when notify is broken *for any reason*. It runs the real
runner against a local server, with `LIVE_WATCH_NOTIFIER` pointed at a fake
that records its calls, so it runs on Linux CI too. It asserts four things:
an alert reaches the notifier, a healthy check does not, `--notify` off does not,
and a failing notifier prints `notify FAILED` while the alert and exit 3 still
stand. Mutation-checked 2026-09-10: reintroducing the shipped `require()` bug
fails it, and so does gating notify away from alerts.
