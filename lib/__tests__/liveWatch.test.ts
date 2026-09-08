import { describe, it, expect } from "vitest";
// Plain ESM on purpose: the unattended watcher must not depend on a TypeScript
// loader on the night it matters, so the classifier it shares is .mjs too.
import { classify, worst, SLOW_MS } from "@/lib/liveWatch.mjs";

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
