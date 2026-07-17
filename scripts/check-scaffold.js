#!/usr/bin/env node
// Scaffold structural self-check.
//
// This repo is all markdown — there's no app code to test. The gate instead
// asserts the scaffold's own contract holds, so that:
//   - contributors can't accidentally break the template structure
//   - the dogfood rule "CI runs the same command as AGENTS.md's Gate" is real
//
// Exit non-zero on any violation. Keep assertions structural, not stylistic.

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function check(label, cond) {
  if (!cond) failures.push(label);
}

function readFile(rel) {
  return readFileSync(join(root, rel), "utf8");
}

// 1. Required files exist
const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md",
  "README.md",
  ".github/workflows/ci.yml",
  "docs/adr/0001-adr-template.md",
];
for (const f of requiredFiles) {
  check(`missing required file: ${f}`, existsSync(join(root, f)));
}

// 2. CLAUDE.md is exactly the @AGENTS.md passthrough (empty-shell contract)
//    Tolerate trailing whitespace/newline differences.
if (existsSync(join(root, "CLAUDE.md"))) {
  const claude = readFile("CLAUDE.md").trim();
  check(
    "CLAUDE.md must be exactly '@AGENTS.md' (the empty-shell contract; rules live only in AGENTS.md)",
    claude === "@AGENTS.md",
  );
}

// 3. docs/adr/ is a directory
check("docs/adr/ must be a directory", existsSync(join(root, "docs", "adr")) && statSync(join(root, "docs", "adr")).isDirectory());

// 4. AGENTS.md contains the load-bearing section anchors that the working
//    agreement depends on. Renaming any of these silently breaks the protocol.
if (existsSync(join(root, "AGENTS.md"))) {
  const agents = readFile("AGENTS.md");
  const requiredAnchors = [
    "## Tech stack",
    "## Hard rules",
    "## Working agreement (multi-agent)",
    "### On starting a shift",
    "### While working",
    "### Gate",
    "### On ending a shift",
    "## Where to find things",
  ];
  for (const anchor of requiredAnchors) {
    check(`AGENTS.md missing section anchor: "${anchor}"`, agents.includes(anchor));
  }

  // 5. Contract consistency: README explicitly forbids HANDOFF.md, so AGENTS.md
  //    must not reference it either — otherwise the two sources disagree.
  check(
    "AGENTS.md must not reference HANDOFF (README forbids it; rules must stay consistent)",
    !/HANDOFF\.?md/i.test(agents),
  );

  // 6. The Gate section must actually run this script — otherwise the
  //    "CI == AGENTS.md Gate" contract is only aspirational.
  check(
    "AGENTS.md Gate section must run the same self-check as CI (node scripts/check-scaffold.js)",
    agents.includes("node scripts/check-scaffold.js"),
  );
}

// 7. The other half of the "CI == AGENTS.md Gate" contract: ci.yml must run
//    this same script. Checking only AGENTS.md leaves the contract one-sided —
//    ci.yml could drift to a different command and the check would stay green.
if (existsSync(join(root, ".github/workflows/ci.yml"))) {
  check(
    ".github/workflows/ci.yml must run the same self-check as AGENTS.md's Gate (node scripts/check-scaffold.js)",
    readFile(".github/workflows/ci.yml").includes("node scripts/check-scaffold.js"),
  );
}

// 8. "No HANDOFF.md" is a filesystem contract, not just prose: asserting only
//    that AGENTS.md never mentions it would miss someone adding the file itself.
check(
  "HANDOFF.md must not exist (progress lives in Issues/PRs — see README)",
  !existsSync(join(root, "HANDOFF.md")),
);

// Report
if (failures.length > 0) {
  console.error(`\n❌ Scaffold self-check failed (${failures.length}):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log("✅ Scaffold self-check passed — structure contract holds.");
