import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyBalanceResponse } from "@/lib/balanceResponse";

// The homepage "Treasury now" tile called every /api/balance failure "live",
// because it tested `source !== "sample"` and error bodies carry no source.
// Measured on a preview deploy 2026-09-10: 503 {"error":"Dune not configured"}
// rendered "-", "peak 0.00" and "treasury live from Solana."

const root = fileURLToPath(new URL("../../", import.meta.url));
// Verbatim from the preview deploy that showed the defect.
const PREVIEW_503 = { error: "Dune not configured", configured: false };
const LIVE_OK = {
  rows: [{ block_date: "2026-09-10", eod_sol_balance: 3.656755645 }],
  source: "live",
};

describe("the old rule reported failures as live (red control)", () => {
  it("`source !== \"sample\"` calls the real 503 body live", () => {
    // Kept as a test so the reason for the allowlist cannot be argued away:
    // this is the expression that shipped, run against the body that exposed it.
    const oldRule = (d: { source?: string }) => d.source !== "sample";
    expect(oldRule(PREVIEW_503 as { source?: string })).toBe(true);
    expect(classifyBalanceResponse(503, PREVIEW_503).live).toBe(false);
  });
});

describe("live is an allowlist", () => {
  it("200 with source live and rows is live", () => {
    const st = classifyBalanceResponse(200, LIVE_OK);
    expect(st.live).toBe(true);
    expect(st.rows).toHaveLength(1);
  });

  it("a 503 is not live, and says why", () => {
    const st = classifyBalanceResponse(503, PREVIEW_503);
    expect(st).toEqual({ live: false, rows: [], reason: "HTTP 503: Dune not configured" });
  });

  it("a 500 with no body is not live", () => {
    expect(classifyBalanceResponse(500, null)).toMatchObject({ live: false, reason: "HTTP 500: no error message" });
  });

  it("a 200 with no source is not live - silence is not health", () => {
    expect(classifyBalanceResponse(200, { rows: LIVE_OK.rows }).live).toBe(false);
  });

  it("a 200 saying sample is not live", () => {
    expect(classifyBalanceResponse(200, { ...LIVE_OK, source: "sample" }).live).toBe(false);
  });

  it("a live answer with no rows is not live", () => {
    expect(classifyBalanceResponse(200, { source: "live", rows: [] })).toMatchObject({
      live: false,
      reason: "no balance rows",
    });
  });
});

describe("the homepage tile uses it", () => {
  it("OnChainProof classifies through lib/balanceResponse, not a source check of its own", () => {
    // Comments stripped: the fix's own comment quotes the old expression.
    const src = readFileSync(`${root}components/OnChainProof.tsx`, "utf8")
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(src).toContain("classifyBalanceResponse(r.status");
    expect(src).not.toMatch(/source\s*!==\s*"sample"/);
  });
});
