/**
 * The SDK boundary: what `lib/ww/index.ts` promises, and whether it can actually
 * leave this repo.
 *
 * THIS FILE EXISTS BECAUSE OF A SPECIFIC FAILURE. `lib/ww/pda.ts` imported
 * `node:crypto`. 646 tests passed, because vitest runs in Node. The first
 * browser build failed outright. A directory whose entire stated purpose is
 * being liftable onto somebody else's stack had a Node-only dependency at its
 * base, and **no test in this repo could have found it** - only asking a bundler
 * to run it in a browser could.
 *
 * So the checks below are deliberately not unit tests of behaviour. They are
 * checks on the SHAPE of the dependency graph, plus one that leaves the process
 * entirely, because the thing that hid last time was hidden precisely by the
 * environment the tests run in.
 *
 * It has already earned itself once: writing it surfaced `Buffer` in
 * `relayPolicy.ts`, Node's own global, which Next silently polyfills in the
 * browser. That module worked everywhere while being the one file here that
 * could not run outside a bundler patching globals.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WW = join(process.cwd(), "lib", "ww");

/**
 * The modules deliberately OUTSIDE the declared surface. Both are the server's:
 * the relay policy and its budget encode what OUR relay forwards, and the
 * widget flag reads `process.env`. They are still checked for portability
 * where it is free, but they are not promises to a consumer.
 */
const SERVER_ONLY = new Set(["relayPolicy.ts", "rateLimit.ts", "widgetFlag.ts", "operatorFlag.ts", "apiSurface.ts", "index.ts"]);

const sourceFiles = readdirSync(WW).filter((f) => f.endsWith(".ts"));
const read = (f: string) => readFileSync(join(WW, f), "utf8");

/** Every module the public entry point re-exports from. */
const exportedFrom = new Set(
  [...read("index.ts").matchAll(/from "\.\/(\w+)"/g)].map((m) => `${m[1]}.ts`),
);

describe("the declared surface", () => {
  it("re-exports from real modules, all of which exist", () => {
    expect(exportedFrom.size).toBeGreaterThan(5);
    for (const f of exportedFrom) expect(sourceFiles).toContain(f);
  });

  /**
   * The point of the line. If a module is reachable from the entry point it is
   * a promise; if it is server-only it must not be. A future `export * from
   * "./relayPolicy"` would silently make our relay's policy part of somebody
   * else's API.
   */
  it("does not export anything from the server-only modules", () => {
    for (const f of SERVER_ONLY) {
      if (f === "index.ts") continue;
      expect([...exportedFrom]).not.toContain(f);
    }
  });

  it("covers every module that is not server-only", () => {
    const shouldBePublic = sourceFiles.filter((f) => !SERVER_ONLY.has(f));
    // If this fails, a module was added and never decided about. Deciding it is
    // private is fine - add it to SERVER_ONLY and say why. Leaving it undecided
    // is what this catches.
    expect([...exportedFrom].sort()).toEqual(shouldBePublic.sort());
  });
});

describe("portability, by inspection", () => {
  it("no module in lib/ww imports a node: builtin", () => {
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      for (const m of read(f).matchAll(/^\s*import[^;]*from\s+["'](node:[^"']+)["']/gm)) {
        offenders.push(`${f} imports ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Broader than the node: check and the reason this file is not just the old
   * one renamed. A dependency on an npm package is as fatal to "lift this onto
   * another stack" as a dependency on Node, and the old check could not see it.
   */
  it("no module in lib/ww imports anything non-relative", () => {
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      for (const m of read(f).matchAll(/^\s*import[^;]*from\s+["']([^"']+)["']/gm)) {
        if (!m[1].startsWith(".")) offenders.push(`${f} imports ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * `Buffer` is Node's. Next polyfills it in the browser, so a module using it
   * works in this app and fails anywhere else - which is exactly the shape of
   * the defect this file was written for. Found in relayPolicy.ts on
   * 2026-09-18 and removed.
   */
  it("no module in lib/ww uses Buffer, which Next polyfills and other stacks do not", () => {
    const offenders: string[] = [];
    for (const f of sourceFiles) {
      read(f)
        .split("\n")
        .forEach((line, i) => {
          const code = line.replace(/^\s*\*.*$/, "").replace(/\/\/.*$/, "");
          if (/\bBuffer\b/.test(code)) offenders.push(`${f}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it("only the deliberately server-only flags and the surface that reads them touch process", () => {
    const users = sourceFiles.filter((f) => {
      return read(f)
        .split("\n")
        .some((line) => {
          const code = line.replace(/^\s*\*.*$/, "").replace(/\/\/.*$/, "");
          return /\bprocess\./.test(code);
        });
    });
    // apiSurface names no variable of its own - it asks the flag modules,
    // which do - but it defaults its `env` argument to process.env, so it is
    // server-only for the same reason they are.
    expect(users).toEqual(["apiSurface.ts", "operatorFlag.ts", "widgetFlag.ts"]);
  });
});

describe("portability, by leaving the process", () => {
  /**
   * Writes a file OUTSIDE the repository, imports the entry point by absolute
   * path, and runs it in a fresh process with no vitest, no Next, no tsconfig
   * paths and no `@/` aliases. What it proves is that the surface actually
   * imports and executes without this app's build setup.
   *
   * WHAT IT DOES NOT PROVE, measured by mutation on 2026-09-18 rather than
   * reasoned about, because the first draft of this comment claimed it "cannot
   * be fooled by the environment it runs in" and that was wrong:
   *
   *   - A `node:crypto` import passes here. This subprocess IS Node. That is
   *     the same blind spot vitest had, moved to a different process - the
   *     static checks above are what catch it.
   *   - An npm import passes here too. Node resolves `node_modules` by walking
   *     up from the IMPORTING file, which is inside this repo, so `cwd` being a
   *     temp directory does not isolate it. Again the static check catches it.
   *
   * So the three checks divide the work and none of them is the whole answer:
   * source inspection catches the dependency, this catches alias and build
   * coupling, and **only `npm run build` catches the transitive browser case**.
   * A directory that has never been bundled is not a directory that has been
   * proved portable.
   */
  it("imports and runs outside this app, with no bundler and no aliases", () => {
    const dir = mkdtempSync(join(tmpdir(), "ww-sdk-boundary-"));
    const entry = join(WW, "index.ts").replace(/\\/g, "/");
    const probe = join(dir, "probe.mts");
    writeFileSync(
      probe,
      [
        `import * as ww from "${entry}";`,
        // Exercise the parts that would need a runtime the SDK must not assume.
        `const battle = ww.battlePda(1788574136);`,
        `const mint = ww.mintPda(1788574136, "a");`,
        `const ix = ww.claimSharesInstruction({ battleId: 1788574136, trader: battle });`,
        `const hash = ww.sha256(new TextEncoder().encode("abc"));`,
        `const err = ww.explainSimulationError({ InstructionError: [2, { Custom: 6001 }] });`,
        `if (battle.length < 32) throw new Error("battlePda looks wrong");`,
        `if (mint.length < 32) throw new Error("mintPda looks wrong");`,
        `if (ix.keys.length !== 9) throw new Error("claim should have nine accounts");`,
        `if (hash.length !== 32) throw new Error("sha256 should return 32 bytes");`,
        `if (err !== "Battle has already ended") throw new Error("error mapping is wrong: " + err);`,
        `console.log("SDK_BOUNDARY_OK");`,
      ].join("\n"),
    );

    const out = execFileSync("npx", ["tsx", probe], {
      encoding: "utf8",
      cwd: dir, // NOT the repo: no tsconfig, no paths, no node_modules of ours
      env: { ...process.env, NODE_ENV: "test" },
      timeout: 120_000,
    });
    expect(out).toContain("SDK_BOUNDARY_OK");
  }, 120_000);
});
