import { describe, it, expect } from "vitest";
// Plain ESM on purpose: the unattended watcher must not depend on a TypeScript
// loader on the night it matters, so the classifier it shares is .mjs too.
import { classify, classifyPage, worst, summarise, SLOW_MS, PAGE_MARKER } from "@/lib/liveWatch.mjs";

// The Grand Final is 2026-09-13 and /live will be watched unattended through it.
// These assert the states worth waking somebody for are actually detected,
// because a watcher is the one piece of software whose failure mode is silence -
// and silence is indistinguishable from everything being fine.

const ok = {
  httpStatus: 200,
  latencyMs: 120,
  body: {
    status: "live",
    data: { battleId: 1788580997, running: true, truncatedA: false, truncatedB: false },
  },
};

describe("the healthy case still reports", () => {
  it("emits a verdict rather than nothing", () => {
    // A watcher that says nothing when healthy cannot be distinguished from a
    // watcher that has died.
    const v = classify(ok);
    expect(v).toHaveLength(1);
    expect(v[0].level).toBe("ok");
    expect(worst(v)).toBe("ok");
  });
});

describe("the states that mean something", () => {
  it("catches status unknown, which arrives inside a 200", () => {
    // The contract is 200 even when chain cannot be read, so anything checking
    // HTTP status alone sees a perfectly healthy endpoint.
    const v = classify({ ...ok, body: { status: "unknown", data: null } });
    expect(v[0].code).toBe("UNKNOWN");
    expect(worst(v)).toBe("alert");
  });

  it("distinguishes a rejected credential from a generic failure", () => {
    // This is what a botched key rotation looks like, and the key is being
    // rotated before the 13th.
    const v = classify({
      ...ok,
      body: { status: "unknown", data: null, note: "rpc getAccountInfo: HTTP 401" },
    });
    expect(v[0].code).toBe("UNAUTHORIZED");
    expect(worst(v)).toBe("alert");
  });

  it("separates an exhausted budget from a generic failure", () => {
    // The RPC key was published in a public response body from 2026-09-06, and
    // rotation is deliberately deferred until after the Grand Final because the
    // budget is what keeps /live up. So the key is knowingly disclosed through
    // the 13th, and this is the shape a theft would arrive in - not a rejected
    // credential, but our own budget being eaten by someone else.
    const v = classify({
      ...ok,
      body: { status: "unknown", data: null, note: "rpc getAccountInfo: HTTP 429 rate limited" },
    });
    expect(v[0].code).toBe("RATE_LIMITED");
    expect(worst(v)).toBe("alert");
  });

  it("does not confuse a rate limit with a rejected credential", () => {
    // On the night, "the budget is gone" and "the key stopped working" want
    // different responses, so they must not collapse into one code.
    const limited = classify({ ...ok, body: { status: "unknown", data: null, note: "HTTP 429 rate limited" } });
    const rejected = classify({ ...ok, body: { status: "unknown", data: null, note: "HTTP 401" } });
    expect(limited[0].code).not.toBe(rejected[0].code);
  });

  it("treats a non-200 as our deployment breaking, not chain", () => {
    const v = classify({ ...ok, httpStatus: 500 });
    expect(v[0].code).toBe("HTTP_ERROR");
    expect(worst(v)).toBe("alert");
  });

  it("catches the endpoint going quiet entirely", () => {
    const v = classify({
      httpStatus: 0, latencyMs: 15000, body: null,
      transportError: "The operation was aborted due to timeout",
    });
    expect(v[0].code).toBe("UNREACHABLE");
    expect(worst(v)).toBe("alert");
  });

  it("warns on latency before it becomes an outage", () => {
    const v = classify({ ...ok, latencyMs: SLOW_MS + 1 });
    expect(v.some((x) => x.code === "SLOW")).toBe(true);
    expect(worst(v)).toBe("warn");
  });

  it("does not warn on latency just under the threshold", () => {
    expect(classify({ ...ok, latencyMs: SLOW_MS - 1 })[0].code).toBe("OK");
  });

  it("reports a stale body as a warning, not an alert", () => {
    const v = classify({ ...ok, body: { status: "stale", ageSeconds: 240, data: {} } });
    expect(v[0].code).toBe("STALE");
    expect(worst(v)).toBe("warn");
  });

  it("refuses to accept a 200 whose body is not an object", () => {
    expect(classify({ ...ok, body: "fine" })[0].code).toBe("UNPARSEABLE");
  });
});

describe("a battle that ended and was never settled", () => {
  it("is not a healthy OK", () => {
    // 93 battles are in this state and every one of them used to report as
    // running. If the resolver picks one on the night, /live is showing a dead
    // battle and a watcher keyed on `running` sees nothing wrong.
    //
    // Raised from warn to alert on 2026-09-08: during the Grand Final this is
    // not a note in a log, it is the page showing the wrong event to everyone
    // watching. The severity assertion lives in its own test below.
    const v = classify({
      ...ok,
      body: { status: "live", data: { battleId: 7, running: false, expired: true, settled: false } },
    });
    expect(v.some((x) => x.code === "EXPIRED_BATTLE")).toBe(true);
    expect(worst(v)).not.toBe("ok");
  });

  it("does not fire on an ordinary settled battle", () => {
    const v = classify({
      ...ok,
      body: { status: "live", data: { battleId: 7, running: false, expired: false, settled: true } },
    });
    expect(v[0].code).toBe("NOT_RUNNING");
    expect(worst(v)).toBe("info");
  });
});

describe("the holder cap, which the Grand Final is most likely to trip", () => {
  it("reports truncation as information, not as a failure", () => {
    // The most holders any side has ever ended with is 18, measured across all
    // 1,643 battles. If the 13th is the night it hits 20, the holder counts on
    // the page silently become lower bounds and somebody should know.
    const v = classify({
      ...ok,
      body: { status: "live", data: { battleId: 1, running: true, truncatedA: true } },
    });
    expect(v.some((x) => x.code === "TRUNCATED")).toBe(true);
    expect(worst(v)).toBe("info");
  });
});

describe("worst()", () => {
  it("returns the highest severity present", () => {
    expect(worst([{ level: "ok", code: "", message: "" }, { level: "alert", code: "", message: "" }]))
      .toBe("alert");
  });
  it("is ok on an empty set rather than throwing", () => {
    expect(worst([])).toBe("ok");
  });
});

describe("the page probe, which the API probe does not cover", () => {
  // Viewers open /live, not /api/ww/positions. The two fail independently: the
  // route can be perfectly healthy while the page fails to render, because the
  // page is a client component and its bundle, shell or deploy can break alone.
  const good = { httpStatus: 200, latencyMs: 300, html: `<title>${PAGE_MARKER} - wwtracker</title>` };

  it("passes when the server-rendered shell is there", () => {
    expect(classifyPage(good)[0].code).toBe("PAGE_OK");
  });

  it("catches a 200 that is not actually the page", () => {
    // The exact shape that nearly fooled a sibling lane today: a catch-all
    // answering 200 with something that is not the thing you asked for. A
    // status code is not a rendered page.
    const v = classifyPage({ ...good, html: '{"status":"live"}' });
    expect(v[0].code).toBe("PAGE_BROKEN");
    expect(worst(v)).toBe("alert");
  });

  it("catches a non-200 and an unreachable page", () => {
    expect(classifyPage({ ...good, httpStatus: 404 })[0].code).toBe("PAGE_ERROR");
    expect(classifyPage({ httpStatus: 0, latencyMs: 9, html: null, transportError: "fetch failed" })[0].code)
      .toBe("PAGE_UNREACHABLE");
  });

  it("warns on a slow page without calling it broken", () => {
    const v = classifyPage({ ...good, latencyMs: SLOW_MS + 1 });
    expect(v[0].code).toBe("PAGE_SLOW");
    expect(worst(v)).toBe("warn");
  });

  it("does not assert on client-rendered content", () => {
    // The holder tables are client-side and legitimately absent from the HTML.
    // Asserting on them would fail every single cycle, and a watcher that cries
    // wolf every minute is one nobody reads on the night it matters.
    expect(good.html).not.toContain("SIDE A");
    expect(classifyPage(good)[0].level).toBe("ok");
  });
});

describe("an unreadable state must never render as healthy", () => {
  // The inverted alarm, found in this file's own classifier on 2026-09-08 by
  // testing it rather than reading it. A 200 with no status field and null data
  // classified as "ok: live" - the less the response said, the healthier it
  // looked. Same mistake as the spend guard, different costume.
  it("alerts when the status field is missing", () => {
    const v = classify({ httpStatus: 200, latencyMs: 100, body: { data: null } });
    expect(v[0].code).toBe("UNRECOGNISED_STATUS");
    expect(worst(v)).toBe("alert");
  });

  it("alerts when the status field is renamed or unexpected", () => {
    // A proxy substituting its own body, or upstream renaming a field, both
    // arrive looking like this.
    const v = classify({ httpStatus: 200, latencyMs: 100, body: { status: "healthy", data: {} } });
    expect(v[0].code).toBe("UNRECOGNISED_STATUS");
  });

  it("only an explicit live may reach OK", () => {
    expect(classify({ httpStatus: 200, latencyMs: 100, body: { status: "live", data: { battleId: 1 } } })[0].code)
      .toBe("OK");
  });
});

describe("the HTTP status is folded into what is reported", () => {
  it("says HTTP 200 on the healthy line, so a silent flip is legible", () => {
    const v = classify({ httpStatus: 200, latencyMs: 90, body: { status: "live", data: { battleId: 5 } } });
    expect(v[0].message).toContain("HTTP 200");
  });

  it("names the code on a page error rather than describing a blob", () => {
    expect(classifyPage({ httpStatus: 404, latencyMs: 50, html: "" })[0].message).toContain("404");
  });
});

describe("retry before alarming", () => {
  const bad = [{ level: "alert" as const, code: "UNREACHABLE", message: "nothing answered" }];
  const good = [{ level: "ok" as const, code: "OK", message: "HTTP 200, live" }];

  it("does not alarm on a single failure that recovers", () => {
    // One failed curl fired an alarm two lanes over, self-healed in under two
    // minutes, and spent a second alarm recovering. Two pages for something
    // that was never broken teaches people to ignore the pager.
    const v = summarise([bad, good]);
    expect(worst(v)).toBe("info");
    expect(v[0].code).toBe("FLAPPED");
  });

  it("still reports the flap, because hiding it is the same problem slower", () => {
    expect(summarise([bad, good])[0].message).toContain("1 failed attempt");
  });

  it("alarms when every attempt fails", () => {
    const v = summarise([bad, bad, bad]);
    expect(worst(v)).toBe("alert");
    expect(v[0].message).toContain("3/3 attempts failed");
  });

  it("passes a clean first attempt straight through", () => {
    expect(summarise([good])).toEqual(good);
  });

  it("treats no attempts at all as a broken watcher, not as health", () => {
    const v = summarise([]);
    expect(worst(v)).toBe("alert");
    expect(v[0].code).toBe("NO_ATTEMPTS");
  });
});

describe("an expired battle during the Final is visible to everyone watching", () => {
  it("is an alert, not a note", () => {
    // 93 battles reported running:true before #249, one 298 days past its
    // window. If the resolver picks one on the night, /live shows a dead battle
    // with a countdown while everything else looks fine.
    const v = classify({
      ...{ httpStatus: 200, latencyMs: 100 },
      body: { status: "live", data: { battleId: 7, running: false, expired: true, settled: false } },
    });
    expect(v.some((x) => x.code === "EXPIRED_BATTLE")).toBe(true);
    expect(worst(v)).toBe("alert");
  });
});
