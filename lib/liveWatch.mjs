// What counts as a problem on /live, decided as a pure function so it can be
// tested rather than trusted.
//
// Written for the Grand Final on 2026-09-13, which /live will be watched through
// unattended. The design constraint that matters: a watcher that only reports
// success is silent through a crashloop, and silence reads exactly like fine.
// So every check produces a verdict, including the healthy one, and the absence
// of verdicts is itself detectable.
//
// The states worth waking someone for are not the ones easiest to check:
//
//   UNKNOWN     the endpoint answered but could not read chain. This is the
//               normal shape of an RPC failure, and it is a 200, so anything
//               checking HTTP status alone sees nothing wrong.
//   UNAUTHORIZED the RPC rejected our key. This is what a botched key rotation
//               looks like, and the key is being rotated before the 13th.
//   SLOW        the endpoint still works and is degrading. The interesting
//               signal precedes the outage.
//   UNREACHABLE nothing answered at all.
//   HTTP_ERROR  our own deployment is broken, as opposed to chain being
//               unreadable.
//
// TRUNCATED is reported but is not a failure. It means a side hit the 20-account
// cap on getTokenLargestAccounts, which has never happened - the most holders
// any side has ever ended with is 18, measured across all 1,643 battles. The
// Grand Final is the most likely event ever to trip it, and if it does, the
// holder counts on the page become lower bounds. Worth knowing that night.

/**
 * @typedef {"ok"|"info"|"warn"|"alert"} Level
 * @typedef {{level: Level, code: string, message: string}} Verdict
 * @typedef {{httpStatus: number, latencyMs: number, body: unknown, transportError?: string}} Probe
 */

/** Above this, the endpoint is degrading even though it still answers. */
export const SLOW_MS = 4000;

/** The server-rendered marker that proves /live returned the real page, not a
 * catch-all or an error shell. A SPA catch-all answering 200 is exactly how a
 * sibling lane nearly concluded an endpoint existed today. */
export const PAGE_MARKER = "Live battle positions";


function asRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

/** @param {Probe} p @returns {Verdict[]} */
export function classify(p) {
  /** @type {Verdict[]} */
  const out = [];

  if (p.transportError || p.httpStatus === 0) {
    return [{
      level: "alert",
      code: "UNREACHABLE",
      message: `nothing answered: ${p.transportError ?? "no response"}`,
    }];
  }

  if (p.httpStatus !== 200) {
    // Our contract is 200 even for stale and unknown, so a non-200 means the
    // deployment itself is broken rather than chain being unreadable.
    return [{
      level: "alert",
      code: "HTTP_ERROR",
      message: `endpoint returned HTTP ${p.httpStatus}, which the contract says it never should`,
    }];
  }

  const body = asRecord(p.body);
  if (!body) {
    return [{ level: "alert", code: "UNPARSEABLE", message: "200 with a body that is not an object" }];
  }

  const status = String(body.status ?? "");
  const note = String(body.note ?? "");

  // Only these three are states this endpoint is documented to return. Anything
  // else - a missing field, a renamed one, a proxy substituting its own body -
  // is a state we cannot interpret, and an uninterpretable state must never
  // reach the OK branch at the bottom.
  //
  // It used to. A 200 with no status field and null data classified as
  // "ok: live", which is the inverted alarm in its purest form: the less the
  // response told us, the healthier it looked.
  if (!["live", "stale", "unknown"].includes(status)) {
    return [{
      level: "alert",
      code: "UNRECOGNISED_STATUS",
      message: `HTTP ${p.httpStatus} but status is ${status ? `"${status}"` : "absent"} - `
        + "cannot tell whether this is healthy, so it is not",
    }];
  }

  // A rejected key is the specific failure a rotation causes, and it arrives
  // inside a 200 as status unknown with a note. Checked before the generic
  // unknown so the operator is told which one it is.
  if (/\b(401|403|unauthorized|forbidden|invalid api key)\b/i.test(note)) {
    out.push({
      level: "alert",
      code: "UNAUTHORIZED",
      message: `RPC rejected the credential - this is what a botched key rotation looks like: ${note}`,
    });
  } else if (/\b429\b|rate limit/i.test(note)) {
    // Separated from the generic unknown on purpose, and it matters more than
    // usual right now. The RPC key was published in a public response body from
    // 2026-09-06 and Zaal has decided to rotate it AFTER the Grand Final rather
    // than before, because that key's budget is the thing keeping /live up and
    // a rotation going wrong during the event is the worse risk. The key is
    // therefore knowingly disclosed through the 13th.
    //
    // If somebody took it, this is the shape the theft arrives in: not a
    // rejected credential, but our own budget being eaten by someone else. On
    // the night, "the budget is gone" and "chain is unreadable" want completely
    // different responses, so they get different codes.
    out.push({
      level: "alert",
      code: "RATE_LIMITED",
      message: `RPC budget exhausted - if this fires during the event, suspect the disclosed key `
        + `is being used by somebody else, not that the page is broken: ${note}`,
    });
  } else if (status === "unknown") {
    out.push({
      level: "alert",
      code: "UNKNOWN",
      message: `HTTP ${p.httpStatus}, status unknown${note ? `: ${note}` : ""} - the page cannot read chain`,
    });
  } else if (status === "stale") {
    out.push({
      level: "warn",
      code: "STALE",
      message: `serving a cached body, ${body.ageSeconds ?? "?"}s old`,
    });
  }

  if (p.latencyMs > SLOW_MS) {
    out.push({
      level: "warn",
      code: "SLOW",
      message: `${p.latencyMs}ms to first byte, over the ${SLOW_MS}ms threshold`,
    });
  }

  const data = asRecord(body.data);
  if (status === "live" && data) {
    if (data.truncatedA === true || data.truncatedB === true) {
      out.push({
        level: "info",
        code: "TRUNCATED",
        message: "a side hit the 20-holder read cap - holder counts are now lower bounds, "
          + "and this has never happened before",
      });
    }
    if (data.expired === true) {
      // Neither running nor settled: the window closed and nobody called
      // settlement. Worth saying out loud, because until 2026-09-08 this state
      // was reported as `running` and rendered on /live with a live countdown -
      // one battle 298 days past its window. If the resolver picks one of these
      // on the night, the page is showing a dead battle and everything looks
      // fine.
      out.push({
        level: "alert",
        code: "EXPIRED_BATTLE",
        message: `battle ${data.battleId} ended and was never settled - /live is `
          + "showing a battle that is not running",
      });
    } else if (data.running === false) {
      out.push({
        level: "info",
        code: "NOT_RUNNING",
        message: `battle ${data.battleId} is not running${data.settled ? " (settled)" : ""}`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      level: "ok",
      code: "OK",
      message: `HTTP ${p.httpStatus}, live, ${p.latencyMs}ms, battle ${data?.battleId ?? "?"}`,
    });
  }
  return out;
}

/** The worst level in a set, for deciding whether to wake somebody. */
/** @param {Verdict[]} vs @returns {Level} */
export function worst(vs) {
  const rank = { ok: 0, info: 1, warn: 2, alert: 3 };
  return vs.reduce((acc, v) => (rank[v.level] > rank[acc] ? v.level : acc), "ok");
}

/**
 * The page probe, which the API probe does not cover.
 *
 * Viewers load /live, not /api/ww/positions. The two fail independently: the
 * route can be perfectly healthy while the page fails to render, because the
 * page is a client component and its bundle, its shell or its deploy can break
 * on their own. "Use the artefact the way it will be used" means checking the
 * thing a person opens.
 *
 * The marker is the server-rendered <title>. The holder tables are client-side
 * and are legitimately absent from the HTML, so asserting on them would fail
 * every time and teach whoever is watching to ignore the watcher.
 *
 * @param {{httpStatus:number, latencyMs:number, html:string|null, transportError?:string}} p
 * @returns {Verdict[]}
 */
export function classifyPage(p) {
  if (p.transportError || p.httpStatus === 0) {
    return [{ level: "alert", code: "PAGE_UNREACHABLE",
      message: `/live did not answer: ${p.transportError ?? "no response"}` }];
  }
  if (p.httpStatus !== 200) {
    return [{ level: "alert", code: "PAGE_ERROR",
      message: `/live returned HTTP ${p.httpStatus}` }];
  }
  const html = p.html ?? "";
  if (!html.includes(PAGE_MARKER)) {
    return [{ level: "alert", code: "PAGE_BROKEN",
      message: `/live answered 200 but the shell is missing "${PAGE_MARKER}" - `
        + "a 200 is not a rendered page" }];
  }
  /** @type {Verdict[]} */
  const out = [];
  if (p.latencyMs > SLOW_MS) {
    out.push({ level: "warn", code: "PAGE_SLOW",
      message: `/live took ${p.latencyMs}ms to first byte` });
  }
  if (out.length === 0) {
    out.push({ level: "ok", code: "PAGE_OK", message: `HTTP ${p.httpStatus}, /live renders, ${p.latencyMs}ms` });
  }
  return out;
}

/**
 * Retry before alarming. One failure is weather; three in a row is an outage.
 *
 * Learned two lanes over: a single failed curl fired an alarm, the thing
 * self-healed in under two minutes, and the recovery spent a second alarm. Two
 * pages for something that was never broken teaches people to ignore the pager,
 * which is worse than not having one.
 *
 * A recovery is still reported, at info. A watcher that hides flapping is only
 * a slower version of the same problem - the point is not to be quiet, it is to
 * be quiet about the right things.
 *
 * @param {Verdict[][]} attempts verdicts from each probe, in order
 * @returns {Verdict[]}
 */
export function summarise(attempts) {
  if (attempts.length === 0) {
    // Cannot happen from the runner, and if it does, it is not health.
    return [{ level: "alert", code: "NO_ATTEMPTS", message: "no probe ran - the watcher itself is broken" }];
  }
  const alerted = (vs) => vs.some((v) => v.level === "alert");
  const last = attempts[attempts.length - 1];
  const failed = attempts.filter(alerted).length;

  if (alerted(last)) {
    // Sustained. Say how many attempts it took so a real outage is not confused
    // with a first-try blip in the log.
    return last.map((v) =>
      v.level === "alert"
        ? { ...v, message: `${v.message} [${failed}/${attempts.length} attempts failed]` }
        : v);
  }

  if (failed > 0) {
    return [
      { level: "info", code: "FLAPPED",
        message: `recovered after ${failed} failed attempt${failed === 1 ? "" : "s"} - `
          + "not alarming, but worth seeing if it repeats" },
      ...last,
    ];
  }
  return last;
}
