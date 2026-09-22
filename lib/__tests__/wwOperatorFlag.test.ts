/**
 * The gate between a read-only site and a page that can move money.
 *
 * Small enough to look not worth testing, which is exactly why it is tested: the
 * failure mode is not an exception, it is a money surface quietly existing on a
 * deployment where nobody meant to enable it.
 */
import { describe, expect, it } from "vitest";
import { operatorEnabled } from "../ww/operatorFlag";

describe("operatorEnabled", () => {
  it("is off when the variable is missing entirely", () => {
    expect(operatorEnabled({})).toBe(false);
  });

  it("is on for the values someone would plausibly type", () => {
    for (const v of ["1", "true", "yes", "on", "TRUE", "On", " 1 "]) {
      expect(operatorEnabled({ WW_OPERATOR: v })).toBe(true);
    }
  });

  /**
   * The case a truthiness check gets wrong. `WW_OPERATOR=false` is a non-empty
   * string, so `if (process.env.WW_OPERATOR)` would enable the widget for someone
   * who explicitly turned it off - and they would have no reason to check.
   */
  it("is OFF for values that plainly mean off, which truthiness would get wrong", () => {
    for (const v of ["0", "false", "no", "off", "", "   ", "disabled", "null", "undefined"]) {
      expect(operatorEnabled({ WW_OPERATOR: v })).toBe(false);
    }
  });

  it("defaults to off, so a deployment that never heard of this flag has no operator page", () => {
    // Guards the direction of the default. If this ever inverts, every existing
    // deployment gains a operator page at its next deploy without anyone deciding.
    const realisticProdEnv = { NODE_ENV: "production", VERCEL: "1" };
    expect(operatorEnabled(realisticProdEnv)).toBe(false);
  });

  it("is not a NEXT_PUBLIC_ variable, which would ship its value to every visitor", () => {
    // NEXT_PUBLIC_ variables are inlined into the client bundle by Next.js, so
    // the gate would be readable and flippable in a console. The name is part of
    // the security property, so the name is asserted.
    const source = operatorEnabled.toString();
    expect(source).toContain("WW_OPERATOR");
    expect(source).not.toContain("NEXT_PUBLIC");
  });
});
