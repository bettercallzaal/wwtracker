/**
 * A dead data source and a deliberately unconfigured one used to be the same
 * screen. `BalanceDashboard` had four outcomes and three labels: a 503, an
 * empty result and a thrown error all set `sample` and drew invented rows,
 * and the only thing distinguishing them was an `errorMsg` that nothing
 * rendered.
 */
import { describe, expect, it } from "vitest";
import { balanceBadge, balanceSource } from "../balanceSourceState";

describe("the three not-live facts are three different answers", () => {
  it("calls a 503 what it is: nothing configured here, sample is honest", () => {
    const s = balanceSource({ httpStatus: 503, rowCount: 0 });
    expect(s.state).toBe("not-configured");
    expect(s.sampleIsHonest).toBe(true);
    expect(balanceBadge(s.state)).toBe("SAMPLE");
  });

  it("calls an empty result an empty result, not a fault", () => {
    const s = balanceSource({ httpStatus: 200, rowCount: 0 });
    expect(s.state).toBe("empty");
    expect(s.message).toMatch(/no rows/);
    expect(balanceBadge(s.state)).toBe("NO DATA");
  });

  it("calls a failure a failure, and refuses to let sample rows stand for it", () => {
    const s = balanceSource({ httpStatus: 500, rowCount: 0, error: "boom" });
    expect(s.state).toBe("failed");
    expect(s.sampleIsHonest).toBe(false);
    expect(s.message).toMatch(/boom/);
    expect(s.message).toMatch(/not the treasury/);
    expect(balanceBadge(s.state)).toBe("SOURCE DOWN");
  });

  it("treats a request that never completed as a failure, not an absence", () => {
    const s = balanceSource({ httpStatus: null, rowCount: 0, error: "NetworkError" });
    expect(s.state).toBe("failed");
    expect(s.sampleIsHonest).toBe(false);
    expect(s.message).toMatch(/could not be reached/);
  });
});

describe("a lapsed subscription is named, not spelled as a status code", () => {
  /**
   * Zaal ruled on 2026-09-23 to let the Dune trial lapse and to make the page
   * admit it. "HTTP 402" sends a reader looking for a bug that is not one.
   */
  it.each([401, 402, 403])("explains %i as the lapsed trial", (code) => {
    const s = balanceSource({ httpStatus: code, rowCount: 0 });
    expect(s.state).toBe("failed");
    expect(s.sampleIsHonest).toBe(false);
    expect(s.message).toMatch(/subscription/);
    expect(s.message).toMatch(/2026-09-24/);
    expect(s.message).toMatch(/will not refresh until it is renewed/);
  });
});

describe("live", () => {
  it("says nothing when there is nothing to say", () => {
    const s = balanceSource({ httpStatus: 200, rowCount: 42 });
    expect(s.state).toBe("live");
    expect(s.message).toBe("");
    expect(balanceBadge(s.state)).toBe("LIVE");
  });

  /**
   * The case that would quietly restore the old bug: a source that errored but
   * happened to return rows anyway must not read as live.
   */
  it("does not call an error live just because rows came back with it", () => {
    expect(balanceSource({ httpStatus: 500, rowCount: 42 }).state).toBe("failed");
    expect(balanceSource({ httpStatus: 402, rowCount: 42 }).state).toBe("failed");
  });
});

describe("every state has a badge and every not-live state has a sentence", () => {
  it("leaves no state without words", () => {
    for (const input of [
      { httpStatus: 503, rowCount: 0 },
      { httpStatus: 200, rowCount: 0 },
      { httpStatus: 402, rowCount: 0 },
      { httpStatus: 500, rowCount: 0 },
      { httpStatus: null, rowCount: 0 },
    ]) {
      const s = balanceSource(input);
      expect(s.message.length).toBeGreaterThan(0);
      expect(balanceBadge(s.state).length).toBeGreaterThan(0);
    }
  });
});
