/**
 * The hand-rolled SHA-256, compared against the implementation it replaced.
 *
 * Hand-rolling a hash is normally a bad idea, and it is only defensible here
 * because `node:crypto` is available in THIS environment to check it against -
 * the problem was never that Node lacks a hash, it is that a browser lacks
 * Node's. So the test does the one thing that makes the swap safe: run both over
 * a wide range of inputs and require identical output, including the exact byte
 * lengths PDA derivation produces.
 *
 * This is also the test that would have caught the original defect if it had
 * existed, because it is the only place that says out loud which runtime each
 * implementation needs.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256 } from "../ww/sha256";
import { battlePda, findPda, mintPda, vaultPda } from "../ww/pda";
import buyFixture from "../__fixtures__/ww-buy-transaction.json";

const node = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const ours = (b: Uint8Array) => Buffer.from(sha256(b)).toString("hex");

describe("sha256 matches node:crypto", () => {
  it("agrees on the empty input, where padding is all there is", () => {
    expect(ours(new Uint8Array(0))).toBe(node(new Uint8Array(0)));
    // The known constant, so this cannot pass by both being wrong the same way.
    expect(ours(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("agrees on the standard test vector", () => {
    const abc = new TextEncoder().encode("abc");
    expect(ours(abc)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(ours(abc)).toBe(node(abc));
  });

  /**
   * The block boundary is where a padding bug hides: at 55 bytes the length
   * still fits in the first block, at 56 it does not and a second block is
   * needed. An implementation that gets this wrong is correct for most inputs.
   */
  it("agrees across the 55/56/64 block boundary", () => {
    for (const len of [54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
      const input = new Uint8Array(len).map((_, i) => (i * 7 + 13) & 0xff);
      expect(ours(input), `length ${len}`).toBe(node(input));
    }
  });

  it("agrees on 300 pseudo-random inputs of varying length", () => {
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
    for (let i = 0; i < 300; i++) {
      const len = next() % 200;
      const input = new Uint8Array(len).map(() => next() & 0xff);
      expect(ours(input)).toBe(node(input));
    }
  });

  it("agrees on the exact shape PDA derivation hashes", () => {
    // seed + 8-byte id + 1-byte bump + 32-byte program + 21-byte marker.
    for (const seedText of ["battle", "battle_vault", "artist_a_mint", "artist_b_mint"]) {
      const input = new Uint8Array([
        ...new TextEncoder().encode(seedText),
        ...new Uint8Array(8),
        255,
        ...new Uint8Array(32),
        ...new TextEncoder().encode("ProgramDerivedAddress"),
      ]);
      expect(ours(input)).toBe(node(input));
    }
  });

  it("does not mutate its input", () => {
    const input = Uint8Array.from([1, 2, 3, 4, 5]);
    const before = Buffer.from(input).toString("hex");
    sha256(input);
    expect(Buffer.from(input).toString("hex")).toBe(before);
  });
});

describe("the PDAs still come out right after the swap", () => {
  /**
   * The end-to-end check that matters more than the hash vectors: every derived
   * account in the real mainnet transaction must still derive to the same
   * address. A hash that is subtly wrong would produce different, still
   * well-formed, entirely valid-looking addresses for accounts that do not exist.
   */
  it("reproduces every derived account in the real transaction", () => {
    const id = buyFixture.battle_id;
    expect(battlePda(id)).toBe(buyFixture.accounts_in_order[0]);
    expect(mintPda(id, "a")).toBe(buyFixture.accounts_in_order[1]);
    expect(mintPda(id, "b")).toBe(buyFixture.accounts_in_order[2]);
    expect(vaultPda(id)).toBe(buyFixture.accounts_in_order[9]);
  });

  it("still finds an off-curve address with a real bump", () => {
    const { address, bump } = findPda([new TextEncoder().encode("battle")]);
    expect(address).toHaveLength(44);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });
});

describe("the portability property itself", () => {
  /**
   * The defect this file exists for: lib/ww is meant to run in a browser, and a
   * Node-only import breaks the bundle rather than a test. Nothing in vitest can
   * see that, because vitest is Node - so the guard is a source-level assertion
   * that the portable core imports no Node builtins.
   *
   * Tested by reading the files, which is crude and is the only thing that works
   * from inside Node.
   */
  it("no module in lib/ww imports a node: builtin", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "lib", "ww");
    const offenders: string[] = [];
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, file), "utf8");
      // Ignore prose: only flag an actual import statement.
      for (const m of text.matchAll(/^\s*import[^;]*from\s+["'](node:[^"']+)["']/gm)) {
        offenders.push(`${file} imports ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
