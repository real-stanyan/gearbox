#!/usr/bin/env node
// Gearbox structural self-check.
//
// This repo is all markdown — there's no app code to test. The gate instead
// asserts Gearbox's own contract holds, so that:
//   - contributors can't accidentally break the template structure
//   - the dogfood rule "CI runs the same command as AGENTS.md's Gate" is real
//
// Exit non-zero on any violation. Keep assertions structural, not stylistic.

import { readFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
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
  "docs/gearbox-adr/0001-adr-template.md",
  // B-3 carrier (ADR-0013 → ADR-0026 pull model): the downstream-backfill
  // declaration runs through the PR template — if it disappears, the
  // mechanism dies silently. (DOWNSTREAM.md was retired in ADR-0033.)
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

// 3. docs/gearbox-adr/ is a directory
check("docs/gearbox-adr/ must be a directory", existsSync(join(root, "docs", "gearbox-adr")) && statSync(join(root, "docs", "gearbox-adr")).isDirectory());

// 3b. package.json `files` allowlist must ship the ADR dir that actually exists.
//     Guards the npm/npx channel (ADR-0028): if `files` points at a moved/renamed
//     ADR dir, `npm pack` silently ships zero ADRs and every `npx gearbox-agents`
//     command crashes. Caught exactly this in the docs/adr → docs/gearbox-adr move.
if (existsSync(join(root, "package.json"))) {
  let files = [];
  try {
    files = JSON.parse(readFile("package.json")).files || [];
  } catch {
    check("package.json must be valid JSON", false);
  }
  const shipsAdrDir = files.some((f) => f.replace(/\/$/, "") === "docs/gearbox-adr");
  check(
    "package.json `files` must include \"docs/gearbox-adr/\" (else npm pack ships zero ADRs — ADR-0028/0031)",
    shipsAdrDir,
  );
}

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
    "### Roles of issues & PRs",
    "### PR disposition",
    "### Changing the protocol itself",
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
    "AGENTS.md Gate section must run the same self-check as CI (node scripts/check-gearbox.js)",
    agents.includes("node scripts/check-gearbox.js"),
  );

  // 6a. Hard-rule-by-designation (ADR-0018): the annotation making scattered
  //     "Hard rule" markings L1-protected must survive — removing it silently
  //     shrinks the L1 perimeter back to section-based fencing.
  check(
    "AGENTS.md must keep the hard-rule-by-designation annotation ('counts as part of this section') in the Hard rules section (ADR-0018)",
    agents.includes("counts as part of this section"),
  );

  // 6b. The "open an issue on protocol gap, no silent judgment" rule is a
  //     load-bearing protocol contract (ADR-0003), not stylistic preference.
  //     If an agent removes it, the self-repair loop silently dies. Assert the
  //     rule's key phrase is present verbatim.
  check(
    "AGENTS.md must keep the 'protocol gap -> open issue, no silent judgment' rule (ADR-0003); removing it breaks the self-repair loop",
    agents.includes("silent judgment calls are not allowed") && agents.includes("Protocol gap"),
  );
}

// 7. The other half of the "CI == AGENTS.md Gate" contract: ci.yml must run
//    this same script. Checking only AGENTS.md leaves the contract one-sided —
//    ci.yml could drift to a different command and the check would stay green.
if (existsSync(join(root, ".github/workflows/ci.yml"))) {
  check(
    ".github/workflows/ci.yml must run the same self-check as AGENTS.md's Gate (node scripts/check-gearbox.js)",
    readFile(".github/workflows/ci.yml").includes("node scripts/check-gearbox.js"),
  );
}

// 7b. Downstream-backfill carriers (ADR-0013 → ADR-0026 pull model): the PR
//     template must keep the 'Affects downstream' declaration field (now
//     informational, no longer a merge gate), and AGENTS.md must keep the
//     downstream-backfill rule referencing it. These stay presence-checked so
//     the carriers can't be silently deleted. (DOWNSTREAM.md itself was
//     retired in ADR-0033 — the fleet dashboard is no longer protocol.)
if (existsSync(join(root, ".github/pull_request_template.md"))) {
  check(
    ".github/pull_request_template.md must keep the 'Affects downstream' declaration field (ADR-0013, informational per ADR-0026)",
    readFile(".github/pull_request_template.md").includes("Affects downstream"),
  );
}
if (existsSync(join(root, "AGENTS.md"))) {
  check(
    "AGENTS.md must keep the downstream-backfill rule referencing 'Affects downstream' (ADR-0013/0026)",
    readFile("AGENTS.md").includes("Affects downstream"),
  );
}
// 7c. Protocol files must not be gitignored (ADR-0037): the repo is the only
//     shared memory between shifts — an ignored protocol file exists locally
//     but never reaches the next agent's clone. `git check-ignore` matches
//     .gitignore patterns even for paths that don't exist yet, so this also
//     guards `.gearbox-version` (only written downstream). Skipped when not
//     inside a git repo (e.g. a bare template copy).
const neverIgnored = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md",
  "docs/gearbox-adr",
  ".gearbox-version",
  ".github/workflows/ci.yml",
];
let inGitRepo = false;
try {
  execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
  inGitRepo = true;
} catch {
  /* not a git repo — nothing to check */
}
if (inGitRepo) {
  for (const f of neverIgnored) {
    let ignored = false;
    try {
      // exit 0 = a .gitignore pattern matches this path
      execSync(`git check-ignore -q "${f}"`, { stdio: "ignore" });
      ignored = true;
    } catch {
      /* exit 1 = not ignored */
    }
    check(
      `protocol file must not be gitignored: ${f} (ADR-0037 — it would never reach the next shift's clone)`,
      !ignored,
    );
  }
}

// 8. "No HANDOFF.md" is a filesystem contract, not just prose: asserting only
//    that AGENTS.md never mentions it would miss someone adding the file itself.
check(
  "HANDOFF.md must not exist (progress lives in Issues/PRs — see README)",
  !existsSync(join(root, "HANDOFF.md")),
);

// Report
if (failures.length > 0) {
  console.error(`\n❌ Gearbox self-check failed (${failures.length}):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log("✅ Gearbox self-check passed — structure contract holds.");
