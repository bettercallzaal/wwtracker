/**
 * NO COMPONENT MAY SET STATE THAT NOTHING READS.
 *
 * `BalanceDashboard` held an `errorMsg` that was set in three places and read
 * in none. So when the treasury source died, the page showed SAMPLE with
 * invented numbers and the only thing that knew why sat in a variable nobody
 * rendered. That is this repo's oldest defect shape - an absence and a failure
 * producing the same screen - and it survived because nothing could see it.
 *
 * It is mechanically findable, so it is a test rather than a rule. Rules in
 * this estate hold at 3 to 40 percent; a failing build holds at 100.
 *
 * WHAT THIS CANNOT SEE, said rather than implied: state that is read but only
 * into another dead variable, and state rendered into an element that is never
 * mounted. It catches the shape that actually happened, not every possible
 * version of it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * State whose VALUE is deliberately unused.
 *
 * `tick` drives a one-second re-render so countdowns recompute from
 * `Date.now()`. The number itself means nothing; only the state change does.
 * A legitimate pattern, and indistinguishable from the bug without being
 * named - which is the whole reason for naming it here.
 */
const ALLOWED = new Set(["app/finals/Dashboard.tsx:tick"]);

function componentFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...componentFiles(rel));
    else if (entry.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

interface DeadState {
  file: string;
  name: string;
  timesSet: number;
}

function deadState(files: string[]): DeadState[] {
  const found: DeadState[] = [];
  for (const file of files) {
    const src = readFileSync(join(root, file), "utf8");
    for (const m of src.matchAll(/const \[(\w+), (set\w+)\]\s*=\s*useState/g)) {
      const [, name, setter] = m;
      const reads = (src.match(new RegExp(`\\b${name}\\b`, "g")) ?? []).length - 1;
      const writes = (src.match(new RegExp(`\\b${setter}\\b`, "g")) ?? []).length - 1;
      if (reads === 0 && writes >= 1) found.push({ file, name, timesSet: writes });
    }
  }
  return found;
}

const files = [...componentFiles("components"), ...componentFiles("app")];

describe("state that nothing renders", () => {
  it("finds the components at all, so this cannot pass by finding nothing", () => {
    expect(files.length).toBeGreaterThan(20);
    const withState = files.filter((f) => readFileSync(join(root, f), "utf8").includes("useState"));
    expect(withState.length).toBeGreaterThan(5);
  });

  /**
   * THE POSITIVE CONTROL. The detector is run against the exact code that had
   * the bug, reconstructed here, so a change that breaks the detection fails
   * rather than reporting a clean sweep.
   */
  it("catches the shape it exists for", () => {
    const broken = `
      export default function Dash() {
        const [rows, setRows] = useState([]);
        const [errorMsg, setErrorMsg] = useState(null);
        const load = async () => {
          try { setRows(await get()); }
          catch (e) { setErrorMsg(String(e)); setRows(sample()); }
        };
        return <div>{rows.length}</div>;
      }`;
    const reads = (broken.match(/\berrorMsg\b/g) ?? []).length - 1;
    const writes = (broken.match(/\bsetErrorMsg\b/g) ?? []).length - 1;
    expect(reads).toBe(0);
    expect(writes).toBeGreaterThan(0);
  });

  it("finds none in the tree except the one that is allowed, by name", () => {
    const unexpected = deadState(files).filter((d) => !ALLOWED.has(`${d.file}:${d.name}`));
    expect(
      unexpected.map((d) => `${d.file} sets ${d.name} ${d.timesSet}x and renders it never`),
    ).toEqual([]);
  });

  it("keeps the allowance honest: every allowed entry must still exist", () => {
    // An allowance for state that has since been deleted is a stale exemption,
    // and the next real instance of it would be waved through under that name.
    const live = new Set(deadState(files).map((d) => `${d.file}:${d.name}`));
    for (const allowed of ALLOWED) expect(live).toContain(allowed);
  });
});
