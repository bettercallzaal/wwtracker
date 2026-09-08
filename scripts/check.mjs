#!/usr/bin/env node
// Run every gate, and NEVER lose the reason one failed.
//
//   npm run check
//
// WHY THIS EXISTS. On 2026-09-08 the suite reported "1 failed | 460 passed" on
// main. The command that produced it piped vitest through grep to show a
// one-line summary, so the failure detail went to the pipe and vanished. Five
// clean runs afterwards could not reproduce it, and the evidence was gone: the
// test's name was never seen, let alone its assertion.
//
// That is the same defect the estate corrected in measurement citations the same
// morning - a pipeline whose LAST STAGE SWALLOWS records the exit status of a
// text filter instead of the thing being measured. Knowing the rule did not stop
// it, which is the argument for a tool rather than a habit.
//
// So: full output of every gate is always written to var/check/, whatever
// happens. The terminal gets a summary; the file keeps the evidence. A failure
// you cannot name is a failure you will re-run until it goes away, and that is
// how a gate stops gating.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const GATES = [
  { name: "typecheck", cmd: "npx", args: ["tsc", "--noEmit"] },
  { name: "tests", cmd: "npx", args: ["vitest", "run"] },
  { name: "build", cmd: "npm", args: ["run", "build"] },
  { name: "validate", cmd: "node", args: ["scripts/validate.mjs", "--strict"] },
];

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = `var/check/${stamp}`;
mkdirSync(dir, { recursive: true });

let failed = 0;
const summary = [];

for (const gate of GATES) {
  if (only.length && !only.includes(gate.name)) continue;
  process.stdout.write(`  ${gate.name.padEnd(10)} `);
  const r = spawnSync(gate.cmd, gate.args, { encoding: "utf8" });
  const out = `$ ${gate.cmd} ${gate.args.join(" ")}\n\n` +
    `--- stdout ---\n${r.stdout ?? ""}\n--- stderr ---\n${r.stderr ?? ""}\n` +
    `--- exit ${r.status} ---\n`;
  const path = `${dir}/${gate.name}.txt`;
  writeFileSync(path, out);

  if (r.status === 0) {
    // Pull one interesting line out for the terminal without discarding anything.
    // Per-gate, so `build` does not report its prebuild hook's line instead of
    // its own - the first match in a combined output is not necessarily yours.
    const PATTERN = {
      tests: /Tests +\d+ passed \(\d+\)/,
      build: /Compiled successfully/,
      validate: /validation passed/,
      typecheck: /^$/,
    }[gate.name];
    const hit = PATTERN ? (r.stdout ?? "").match(PATTERN) : null;
    console.log(`ok    ${hit ? hit[0].trim() : ""}`);
    summary.push(`ok    ${gate.name}`);
  } else {
    failed += 1;
    console.log(`FAIL  exit ${r.status}  -> ${path}`);
    // The whole point: the reason is printed, not summarised away.
    const detail = ((r.stdout ?? "") + (r.stderr ?? ""))
      .split("\n")
      .filter((l) => /FAIL|✕|error|Error|AssertionError|expected|✗/.test(l))
      .slice(0, 20);
    for (const line of detail) console.log(`        ${line.trim().slice(0, 140)}`);
    if (detail.length === 0) console.log("        (no matching lines - read the file, the output is complete there)");
    summary.push(`FAIL  ${gate.name}  exit ${r.status}`);
  }
}

writeFileSync(`${dir}/summary.txt`, summary.join("\n") + "\n");
console.log(`\n  full output: ${dir}/`);
console.log(failed ? `  ${failed} gate(s) FAILED` : "  all gates passed");
process.exit(failed ? 1 : 0);
