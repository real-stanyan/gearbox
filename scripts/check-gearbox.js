#!/usr/bin/env node
// Gearbox structural self-check — the upstream gate (ADR-0002).
//
// The gate asserts Gearbox's own contract holds, so that:
//   - contributors can't accidentally break the template structure
//   - the dogfood rule "CI runs the same command as AGENTS.md's Gate" is real
// Fence / section / budget / CI == Gate assertions are shared with the downstream protocol
// check (scripts/lib/protocol-check.js, ADR-0051) and run here in upstream mode.
//
// Exit non-zero on any violation. Keep assertions structural, not stylistic.

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { runProtocolChecks } from "./lib/protocol-check.js";
import { latestTag, releaseState } from "./lib/fence-release.js";

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
  // B-3 carrier (ADR-0013 → ADR-0026 pull model): the downstream-impact declaration runs
  // through the PR template — if it disappears, the mechanism dies silently.
  ".github/pull_request_template.md",
];
for (const f of requiredFiles) check(`missing required file: ${f}`, existsSync(join(root, f)));

// 2. docs/gearbox-adr/ is a directory
check(
  "docs/gearbox-adr/ must be a directory",
  existsSync(join(root, "docs", "gearbox-adr")) && statSync(join(root, "docs", "gearbox-adr")).isDirectory(),
);

// 3. package.json `files` must ship the ADR dir that actually exists (ADR-0028/0031): if it
//    points at a moved dir, `npm pack` silently ships zero ADRs and every npx command crashes.
//    Parsed once, guarded: the version rule (6) reads it too, and invalid JSON is a failure,
//    never a crash.
let pkg = null;
if (existsSync(join(root, "package.json"))) {
  try {
    pkg = JSON.parse(readFile("package.json"));
  } catch {
    check("package.json must be valid JSON", false);
  }
  const files = (pkg && pkg.files) || [];
  check(
    'package.json `files` must include "docs/gearbox-adr/" (else npm pack ships zero ADRs — ADR-0028/0031)',
    files.some((f) => f.replace(/\/$/, "") === "docs/gearbox-adr"),
  );
}

// 4. Shared protocol assertions, upstream mode (ADR-0050/0051): both fences present and
//    unedited, equal fence versions, AGENTS.md ≤ 32 KiB, protocol fence ≤ 20 KiB, required
//    project + fence sections, CLAUDE.md shell, no HANDOFF.md, protocol files not gitignored,
//    and CI runs every Gate command line.
const { errors, protocol, glossary } = runProtocolChecks(root, { upstream: true });
for (const e of errors) failures.push(e);

// 5. Gearbox-specific text contracts
if (existsSync(join(root, "AGENTS.md"))) {
  const agents = readFile("AGENTS.md");
  check(
    "AGENTS.md's Gate must run the self-check (node scripts/check-gearbox.js) — the dogfood CI == Gate contract",
    agents.includes("node scripts/check-gearbox.js"),
  );
  check(
    "AGENTS.md must not reference HANDOFF.md (README forbids it; rules must stay consistent)",
    !/HANDOFF\.?md/i.test(agents),
  );
  // Hard-rule-by-designation (ADR-0018): without the note, scattered "Hard rule" markings
  // silently lose L1 protection.
  check(
    "the protocol fence must keep the hard-rule-by-designation note ('counts as part of the `## Hard rules` section', ADR-0018)",
    agents.includes("counts as part of the `## Hard rules` section"),
  );
  // The protocol-gap rule (ADR-0003) is the self-repair loop's only entry point.
  check(
    "AGENTS.md must keep the 'protocol gap -> open issue, no silent judgment' rule (ADR-0003)",
    agents.includes("silent judgment calls are not allowed") && agents.includes("Protocol gap"),
  );
  check(
    "AGENTS.md must keep the downstream-impact rule referencing 'Affects downstream' (ADR-0013/0026)",
    agents.includes("Affects downstream"),
  );
}
if (existsSync(join(root, ".github/pull_request_template.md"))) {
  check(
    ".github/pull_request_template.md must keep the 'Affects downstream' declaration field (ADR-0013, informational per ADR-0026)",
    readFile(".github/pull_request_template.md").includes("Affects downstream"),
  );
}

// 6. Version rule (ADR-0050, scripts/lib/fence-release.js — shared with rehash-fences.js):
//    fence content that changed since the latest tag ships under package.json's version, bumped
//    past the tag; unchanged content keeps the tag's version. Skipped without tags (the npm
//    package, a fresh clone) — except in CI, where a tagless checkout would silently switch the
//    rule off (ci.yml checks out with fetch-depth: 0).
if (!latestTag(root) && process.env.CI)
  failures.push("CI checkout has no tags — use fetch-depth: 0 on actions/checkout, or the fence version rule has no tag to compare against (ADR-0050)");
if (pkg) for (const e of releaseState(root, { protocol, glossary }, `v${pkg.version}`).errors) failures.push(e);

// Report
if (failures.length > 0) {
  console.error(`\n❌ Gearbox self-check failed (${failures.length}):\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

console.log("✅ Gearbox self-check passed — structure contract holds.");
