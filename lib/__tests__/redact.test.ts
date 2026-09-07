import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { redactUrl, redactSecrets, looksLikeSecret } from "@/lib/redact";

// /api/ww/positions reported its data source by echoing SOLANA_RPC_URL verbatim.
// That is a keyed Helius endpoint, the route is CORS-open and answers 200 to
// anyone, and the key was readable in the response body from the day the live
// positions page shipped.
//
// The key is shared between the production /live page and every local chain
// scan, and its budget is what keeps the page up. Anyone holding it can exhaust
// it, and the page then fails in a way that reads as a broken deployment rather
// than as contention.

const KEYED = "https://mainnet.helius-rpc.com/?api-key=abc123DEF456";

describe("redactUrl", () => {
  it("drops the query string, which is where the key lives", () => {
    expect(redactUrl(KEYED)).toBe("https://mainnet.helius-rpc.com");
    expect(redactUrl(KEYED)).not.toContain("api-key");
    expect(redactUrl(KEYED)).not.toContain("abc123DEF456");
  });

  it("drops basic-auth credentials in the host part", () => {
    expect(redactUrl("https://user:hunter2@rpc.example.com/v1")).toBe(
      "https://rpc.example.com",
    );
  });

  it("keeps the origin, because provenance is the point of the field", () => {
    expect(redactUrl("https://api.mainnet-beta.solana.com")).toBe(
      "https://api.mainnet-beta.solana.com",
    );
  });

  it("never throws, because it runs inside a response path", () => {
    // This function's whole job is keeping a 200 truthful. It must not be the
    // thing that turns a good response into a 500.
    expect(redactUrl(undefined)).toBe("unset");
    expect(redactUrl("")).toBe("unset");
    expect(redactUrl("not a url")).toBe("invalid-url");
  });
});

describe("redactSecrets", () => {
  it("collapses a keyed URL inside an error message", () => {
    const msg = `request to ${KEYED} failed after 3 attempts`;
    const out = redactSecrets(msg);
    expect(out).not.toContain("api-key");
    expect(out).not.toContain("abc123DEF456");
    expect(out).toContain("mainnet.helius-rpc.com");
  });

  it("leaves a clean URL alone", () => {
    expect(redactSecrets("failed against https://api.mainnet-beta.solana.com/x"))
      .toContain("/x");
  });

  it("redacts a bare key=value pair with no URL around it", () => {
    expect(redactSecrets("auth failed, api_key=sk_live_9999")).not.toContain("sk_live_9999");
  });
});

describe("the positions route cannot leak the key again", () => {
  const read = (rel: string) =>
    readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

  it("never puts the raw RPC constant in a response body", () => {
    const route = read("app/api/ww/positions/route.ts");
    // The exact defect: `source: RPC` where RPC is the keyed URL.
    expect(route).not.toMatch(/source:\s*RPC\b(?!_SOURCE)/);
    expect(route).toContain("RPC_SOURCE");
    expect(route).toContain("redactUrl(RPC)");
  });

  it("redacts the error note as well as the source field", () => {
    const route = read("app/api/ww/positions/route.ts");
    // Error messages are the sly path - every built field can be careful while
    // err.message hands back the endpoint it failed against.
    expect(route).toContain("redactSecrets(");
    expect(route).not.toMatch(/note:\s*err instanceof Error \? err\.message/);
  });

  it("flags a leaked source string if one ever comes back", () => {
    expect(looksLikeSecret(KEYED)).toBe(true);
    expect(looksLikeSecret("https://mainnet.helius-rpc.com")).toBe(false);
  });
});
