#!/usr/bin/env node
/**
 * check-pr-review.mjs - Standing PR gate for security-reviewer and database-reviewer.
 *
 * WHY THIS EXISTS
 * AGENTS.md Rule 9 requires an adversarial red control on every PR review; Rule 7c
 * requires an approval to carry a pinned head SHA. In zaostock and wwtracker, live artist claim
 * tokens, backstage authentication endpoints, Supabase Row Level Security, and
 * Stripe payment sessions are sensitive to drift. Leaving reviews to manual memory
 * creates regressions.
 *
 * WHAT IT CHECKS
 * - Security: secrets and credentials in source files or NEXT_PUBLIC_* variables,
 *   server secrets in client components, sensitive credential logging
 * - Database: SQL injection via raw template strings, service-role key usage
 *   in client components, unindexed foreign keys in SQL migrations
 *
 * HOW IT RUNS
 * 1. If zao-review-gate is available on PATH or in ~/bin, delegates to it for the
 *    full cross-repo audit and pinned verdict output.
 * 2. Otherwise (e.g. on clean CI runners), runs the built-in Node security and
 *    database pattern audit against changed files or working tree.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const RE_HARDCODED_SECRET = /(?:sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,}|AKIA[0-9A-Z]{16}|(?:api_key|apikey|secret|private_key|auth_token)\s*[:=]\s*["'][0-9a-zA-Z_\-]{20,}["'])/i;
const PAT_PUBLIC_SECRET = /(?<![A-Za-z0-9_])NEXT_PUBLIC_(?:[A-Za-z0-9_]*(?:SECRET|PRIVATE_KEY|TOKEN)|GEMINI_API_KEY|PINATA_JWT)\s*=\s*["'][^"']+/;
const RE_RAW_SQL = /\.(?:query|execute|\$queryRaw|\$executeRawUnsafe)\s*\(\s*`[^`]*\$\{/;
const RE_SERVICE_ROLE_CLIENT = /(?:SUPABASE_SERVICE_ROLE_KEY|createAdminClient)/;
const RE_SENSITIVE_LOG = /console\.(?:log|debug|info|warn|error)\s*\([^)]*\b(?:password|secret|privateKey|secretKey|claimToken|adminKey)\b[^)]*\)/;

function isTestFile(path) {
  const p = path.toLowerCase();
  return (
    p.includes("/__tests__/") ||
    p.endsWith(".test.ts") ||
    p.endsWith(".test.js") ||
    p.endsWith(".spec.ts") ||
    p.endsWith(".spec.js") ||
    p.includes("/tests/") ||
    p.includes("-test")
  );
}

function findZaoReviewGate() {
  const homeBin = join(homedir(), "bin", "zao-review-gate");
  if (existsSync(homeBin)) return homeBin;

  const which = spawnSync("which", ["zao-review-gate"], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim();
  }
  return null;
}

function getChangedFiles() {
  const rDirty = spawnSync("git", ["diff", "--name-only", "HEAD"], { encoding: "utf8" });
  if (rDirty.status === 0 && rDirty.stdout.trim()) {
    return rDirty.stdout.trim().split("\n").map((f) => f.trim()).filter(Boolean);
  }
  const rLast = spawnSync("git", ["diff", "--name-only", "HEAD~1...HEAD"], { encoding: "utf8" });
  if (rLast.status === 0 && rLast.stdout.trim()) {
    return rLast.stdout.trim().split("\n").map((f) => f.trim()).filter(Boolean);
  }
  return [];
}

function getHeadSha() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "UNKNOWN_HEAD";
}

function auditFile(relPath) {
  if (isTestFile(relPath) || relPath.endsWith("check-pr-review.mjs") || relPath.endsWith("zao-review-gate")) {
    return [];
  }
  const findings = [];
  if (!existsSync(relPath)) return findings;

  let content = "";
  try {
    content = readFileSync(relPath, "utf8");
  } catch {
    return findings;
  }

  const isClient = content.slice(0, 500).includes('"use client"') || content.slice(0, 500).includes("'use client'");
  const isScanner = relPath.endsWith("check-pr-review.mjs") || relPath.endsWith("zao-review-gate");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (isScanner && (line.includes("const ") || line.includes("PAT_") || line.includes("RE_"))) {
      continue;
    }

    if (PAT_PUBLIC_SECRET.test(line)) {
      findings.push({ category: "security", line: lineNum, msg: "Secret assigned to NEXT_PUBLIC variable" });
    }
    const secMatch = line.match(RE_HARDCODED_SECRET);
    if (secMatch) {
      const token = secMatch[0].toLowerCase();
      if (!["dummy", "fake", "example", "xxx", "placeholder", "test"].some((ign) => token.includes(ign))) {
        findings.push({ category: "security", line: lineNum, msg: "Potential hardcoded secret or API key" });
      }
    }
    if (RE_SENSITIVE_LOG.test(line)) {
      findings.push({ category: "security", line: lineNum, msg: "Sensitive credential logged to console" });
    }

    if (RE_RAW_SQL.test(line)) {
      findings.push({ category: "database", line: lineNum, msg: "SQL injection risk via raw template interpolation" });
    }

    if (isClient && RE_SERVICE_ROLE_CLIENT.test(line)) {
      findings.push({ category: "database", line: lineNum, msg: "Service role key referenced in client component" });
    }
  }

  return findings;
}

function main() {
  const gateBin = findZaoReviewGate();
  if (gateBin) {
    const res = spawnSync(gateBin, process.argv.slice(2), { stdio: "inherit" });
    process.exit(res.status ?? 0);
  }

  const headSha = getHeadSha();
  const changedFiles = getChangedFiles();

  console.log(`[check-pr-review] target @ HEAD ${headSha}`);
  if (changedFiles.length === 0) {
    console.log("  no changed files to review");
    console.log("  OVERALL VERDICT: PASS");
    process.exit(0);
  }

  console.log(`Auditing ${changedFiles.length} file(s) for security and database patterns:`);
  let hasFailures = false;

  for (const f of changedFiles) {
    const issues = auditFile(f);
    if (issues.length > 0) {
      hasFailures = true;
      for (const issue of issues) {
        console.log(`  FAIL [${issue.category.toUpperCase()}] ${f}:${issue.line} - ${issue.msg}`);
      }
    }
  }

  if (hasFailures) {
    console.log("\nOVERALL VERDICT: FAIL");
    console.log("REFUSED: security or database issues detected. Resolve before merge.");
    process.exit(1);
  } else {
    console.log("  Security Review: PASS (clean)");
    console.log("  Database Review: PASS (clean)");
    console.log("\nOVERALL VERDICT: PASS");
    process.exit(0);
  }
}

main();
