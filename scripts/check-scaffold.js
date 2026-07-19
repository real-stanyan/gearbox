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
  // B-3 carriers (ADR-0013): the downstream-backfill hard rule runs through
  // these two files — if either disappears, the mechanism dies silently.
  "DOWNSTREAM.md",
  ".github/pull_request_template.md",
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
    "### Issue & PR 的角色",
    "### PR 处置",
    "### 协议自身的变更",
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

  // 6b. The "open an issue on protocol gap, no silent judgment" rule is a
  //     load-bearing protocol contract (ADR-0003), not stylistic preference.
  //     If an agent removes it, the self-repair loop silently dies. Assert the
  //     rule's key phrase is present verbatim.
  check(
    "AGENTS.md must keep the 'protocol gap -> open issue, no silent judgment' rule (ADR-0003); removing it breaks the self-repair loop",
    agents.includes("不许 silent 判断") && agents.includes("Protocol gap"),
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

// 7b. B-3 (ADR-0013) contract: the PR template must keep the mandatory
//     "Affects downstream" field, AGENTS.md must keep the backfill hard rule,
//     and DOWNSTREAM.md must keep its project-list section. Losing any of the
//     three silently kills the downstream-backfill mechanism.
if (existsSync(join(root, ".github/pull_request_template.md"))) {
  check(
    ".github/pull_request_template.md must keep the mandatory 'Affects downstream' field (ADR-0013)",
    readFile(".github/pull_request_template.md").includes("Affects downstream"),
  );
}
if (existsSync(join(root, "AGENTS.md"))) {
  check(
    "AGENTS.md must keep the downstream-backfill rule referencing 'Affects downstream' (ADR-0013)",
    readFile("AGENTS.md").includes("Affects downstream"),
  );
}
if (existsSync(join(root, "DOWNSTREAM.md"))) {
  check(
    "DOWNSTREAM.md must keep its '## 已接入项目' section (the list the B-3 hard rule iterates over)",
    readFile("DOWNSTREAM.md").includes("## 已接入项目"),
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
