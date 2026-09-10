#!/usr/bin/env node
// Watch /live through the Grand Final. Built to be run unattended.
//
//   node scripts/live-watch.mjs                    # one check, exit code = severity
//   node scripts/live-watch.mjs --loop --every 60  # keep checking
//
// WHERE THE ALERT LANDS - read this before relying on it:
//
//   Each cycle probes BOTH /api/ww/positions and the /live page itself, and
//   retries up to 3 times over ~10s before alarming - one failure is weather.
//
//   stdout        one line per check, always, including healthy ones. Silence
//                 means the watcher itself died, which is the failure a
//                 success-only watcher hides.
//   the log       appends to var/live-watch.log so an unattended run leaves a
//                 record somebody can read afterwards.
//   exit code     0 ok, 1 info, 2 warn, 3 alert. This is what a cron or a
//                 supervisor keys on.
//   macOS notice  --notify posts a system notification on warn and alert. Only
//                 works while this machine is awake and logged in.
//
// It does NOT reach a phone, a channel, or anybody who is not at this machine.
// If it needs to, that is a delivery decision with credentials attached and it
// is Zaal's, not mine. Say so plainly rather than let anyone believe they are
// covered.
//
// KEY ROTATION. This reads nothing about the RPC endpoint or its key. It probes
// our own public endpoint, which resolves SOLANA_RPC_URL server-side at request
// time, so a rotation cannot break the watcher - and a BOTCHED rotation is
// exactly what it is built to catch, reported as UNAUTHORIZED rather than as a
// generic failure.

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { classify, classifyPage, worst, summarise } from "../lib/liveWatch.mjs";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);

const BASE = val("--base", "https://wwtracker.vercel.app");
const URL_ = val("--url", `${BASE}/api/ww/positions`);
const PAGE = val("--page", `${BASE}/live`);
const EVERY = Number(val("--every", "60")) * 1000;
const TIMEOUT = Number(val("--timeout", "15")) * 1000;
const LOG = val("--log", "var/live-watch.log");
const RANK = { ok: 0, info: 1, warn: 2, alert: 3 };

async function probe() {
  const started = Date.now();
  try {
    const res = await fetch(URL_, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const latencyMs = Date.now() - started;
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { httpStatus: res.status, latencyMs, body };
  } catch (err) {
    return {
      httpStatus: 0,
      latencyMs: Date.now() - started,
      body: null,
      // Never swallow this into an empty result. A timeout that reads as "no
      // holders" is the trap this whole project keeps paying for.
      transportError: err instanceof Error ? err.message : String(err),
    };
  }
}

// Until 2026-09-10 this called `require()`, which does not exist in an ES
// module. The ReferenceError landed in the catch below, so `--notify` - the
// flag `npm run watch:live` passes - never posted a single notification, and
// the watcher printed nothing to say so. A failed notification still must not
// stop the watcher, but it now says it failed instead of vanishing.
function notify(title, text) {
  if (!has("--notify") || process.platform !== "darwin") return;
  try {
    const esc = (s) => String(s).replace(/["\\]/g, "\\$&");
    const r = spawnSync("osascript", [
      "-e",
      `display notification "${esc(text)}" with title "${esc(title)}"`,
    ]);
    if (r.error || r.status !== 0) {
      console.error(`notify FAILED: ${r.error?.message ?? `osascript exit ${r.status}`}`);
    }
  } catch (err) {
    console.error(`notify FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Fetch the page a viewer actually opens, not just the route behind it. */
async function probePage() {
  const started = Date.now();
  try {
    const res = await fetch(PAGE, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
    const html = await res.text().catch(() => null);
    return { httpStatus: res.status, latencyMs: Date.now() - started, html };
  } catch (err) {
    return {
      httpStatus: 0, latencyMs: Date.now() - started, html: null,
      transportError: err instanceof Error ? err.message : String(err),
    };
  }
}

const ATTEMPTS = Number(val("--attempts", "3"));
const GAP_MS = Number(val("--gap", "3500"));

/**
 * Probe up to ATTEMPTS times, stopping as soon as one comes back clean.
 * Three attempts spaced 3.5s is about ten seconds - long enough that a blip
 * resolves itself, short enough that a real outage is not hidden.
 */
async function attempt(probeFn, classifyFn) {
  const rounds = [];
  for (let i = 0; i < ATTEMPTS; i++) {
    const vs = classifyFn(await probeFn());
    rounds.push(vs);
    if (!vs.some((v) => v.level === "alert")) break;
    if (i < ATTEMPTS - 1) await new Promise((r) => setTimeout(r, GAP_MS));
  }
  return summarise(rounds);
}

async function once() {
  // Both, every cycle. The route can be healthy while the page fails to render
  // - they break independently, and a viewer only ever sees the page.
  const [apiVerdicts, pageVerdicts] = await Promise.all([
    attempt(probe, classify),
    has("--no-page") ? Promise.resolve([]) : attempt(probePage, classifyPage),
  ]);
  const verdicts = [...apiVerdicts, ...pageVerdicts];
  const level = worst(verdicts);
  const stamp = new Date().toISOString();

  for (const v of verdicts) {
    const line = `${stamp} ${v.level.toUpperCase().padEnd(5)} ${v.code.padEnd(12)} ${v.message}`;
    console.log(line);
    try {
      mkdirSync(LOG.replace(/\/[^/]+$/, ""), { recursive: true });
      appendFileSync(LOG, line + "\n");
    } catch {
      // Logging failing is not a reason to stop watching.
    }
  }
  if (RANK[level] >= RANK.warn) {
    const v = verdicts.find((x) => x.level === level);
    notify(`wwtracker /live: ${v.code}`, v.message);
  }
  return RANK[level];
}

if (has("--loop")) {
  // A heartbeat every cycle, so that no output at all means the watcher died
  // rather than that everything is fine.
  for (;;) {
    await once();
    await new Promise((r) => setTimeout(r, EVERY));
  }
} else {
  process.exit(await once());
}
