import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, cpSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { findFence } from "../scripts/lib/fence.js";
import { sectionBody } from "../scripts/lib/sections.js";
import { ciYml } from "../scripts/lib/workflows.js";
import { REPO, makeUpstream, runTool, gitInit, git, tmp, read, write, commitAll } from "./helpers.js";

// The real output of the v1.15.2 installer (--name example-project --maintainer octo-owner
// --gate "npm test"): Gearbox's own public template text, generated from the v1.15.2 tag.
const FX = join(REPO, "test/fixtures/v1.15.2-install");
const AGENTS_V1 = readFileSync(join(FX, "AGENTS.md"), "utf8");
const CONTEXT_V1 = readFileSync(join(FX, "CONTEXT.md"), "utf8");
const WHILE_WORKING = "- Commit in small steps; the message should spell out the **why**, not just the what";
const BRANCHES = "docs/gearbox-backfill-*";

// A v1 downstream as the v1.15.2 installer left it, committed on main. `files` adds paths.
function v1Downstream(up, { agents = AGENTS_V1, context = CONTEXT_V1, files = {} } = {}) {
  const down = tmp("gearbox-v1-");
  gitInit(down);
  write(down, "AGENTS.md", agents);
  write(down, "CONTEXT.md", context);
  write(down, "CLAUDE.md", "@AGENTS.md\n");
  write(down, ".github/workflows/ci.yml", ciYml("npm test"));
  write(down, ".github/workflows/gearbox-sync.yml", "run: npx -y gearbox-agents@latest update --refresh-drift\n");
  write(down, ".gearbox-version", "v1.15.2\n");
  cpSync(join(up, "docs/gearbox-adr"), join(down, "docs/gearbox-adr"), { recursive: true });
  for (const [rel, text] of Object.entries(files)) write(down, rel, text);
  commitAll(down, "a v1 downstream");
  return down;
}
const update = (down, up, args = []) => runTool("gearbox-update", ["--no-push", ...args], { cwd: down, env: { GEARBOX_DIR: up } });
// Enough "Where to find things" lines to push the assembled AGENTS.md past 32 KiB.
const BIG_INDEX = Array.from({ length: 1200 }, (_, i) => `- \`src/module-${i}.ts\` — module ${i}`).join("\n");
const INDEX_PLACEHOLDER = "- <other module documentation directories, e.g. docs/modules/>";

test("update migrates a real v1.15.2 install to the v2 layout on a backfill branch", () => {
  const up = makeUpstream();
  assert.ok(AGENTS_V1.includes(WHILE_WORKING), "fixture drifted: While working bullet not found");
  const agentsIn = AGENTS_V1.replace(WHILE_WORKING, `${WHILE_WORKING}\n- Search closed issues before claiming a task (project ADR-0148)`);
  const down = v1Downstream(up, {
    agents: agentsIn,
    context: CONTEXT_V1.replace("|---|---|---|\n", "|---|---|---|\n| star | loyalty point | — |\n"),
  });

  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  const agents = read(down, "AGENTS.md");
  assert.equal(findFence(agents, "protocol").block, findFence(read(up, "AGENTS.md"), "protocol").block);
  assert.match(sectionBody(agents, 2, "Gate"), /npm test/);
  assert.match(agents, /GitHub account: `octo-owner`/);
  assert.match(sectionBody(agents, 2, "Local protocol extensions"), /Search closed issues before claiming a task/);
  assert.match(read(down, "CONTEXT.md"), /\| star \| loyalty point \| — \|/);
  assert.equal(read(down, ".gearbox-version").trim(), "v2.0.0");
  assert.ok(existsSync(join(down, ".github/workflows/gearbox-check.yml")));
  assert.match(read(down, ".github/workflows/gearbox-sync.yml"), /gearbox-agents@2/);
  assert.match(read(down, "gearbox-update-report.md"), /v1 → v2 layout migration/);
  const c = runTool("gearbox-check", [], { cwd: down });
  assert.equal(c.code, 0, c.out);

  // Everything is committed on the backfill branch; main still holds the v1 text.
  assert.match(git(down, "rev-parse", "--abbrev-ref", "HEAD"), /^docs\/gearbox-backfill-/);
  assert.match(git(down, "log", "--format=%s", "main..HEAD"), /^docs\(protocol\): migrate to the Gearbox v2 layout \(v2\.0\.0\)$/m);
  assert.equal(git(down, "rev-list", "--count", "main"), "1");
  assert.equal(git(down, "show", "main:AGENTS.md"), agentsIn.trim());
  assert.equal(git(down, "status", "--porcelain"), "?? gearbox-update-report.md");
});

// migrateV1 throws MigrationError when the fences don't pair up: the sections after an open
// fence would read as code and sink into one subsection. Refused before the branch step.
test("a v1 AGENTS.md whose code fences don't pair up is refused at its line, before any branch or write", () => {
  const up = makeUpstream();
  const agents = AGENTS_V1.replace("<Project tech stack, one per line. Example: Next.js 15 / TypeScript / Postgres>", "```bash\nnpm run build");
  const line = agents.split("\n").indexOf("```bash") + 1;
  const down = v1Downstream(up, { agents });
  const r = update(down, up);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, new RegExp(`AGENTS\\.md line ${line}: `));
  assert.equal(git(down, "branch", "--list", BRANCHES), "");
  assert.equal(git(down, "rev-parse", "--abbrev-ref", "HEAD"), "main");
  assert.equal(git(down, "status", "--porcelain"), "");
});

test("the migration report lists what moved where and every item that needs a human", () => {
  const up = makeUpstream();
  const agents = AGENTS_V1
    .replace(WHILE_WORKING, `${WHILE_WORKING}\n- Search closed issues before claiming a task (project ADR-0148)`)
    .replace("### PR disposition (merge rules)", "### Worktree discipline (project ADR-0149)\n\n- One worktree per lane.\n\n### PR disposition (merge rules)")
    .replace(
      /(### On ending a shift \(shift-end rules\)\n\n)[\s\S]*?(\n\n### Parallel shifts)/,
      (_, head, tail) => `${head}1. Gate green, then push.\n2. Post a summary in the team channel.\n3. Close the lane's issues.${tail}`,
    )
    .replace("## Where to find things", "## Runbook\n\n- Restart the worker with `make restart`.\n\n## Where to find things");
  const context = CONTEXT_V1
    .replace(/^\| handoff \| .*$/m, "| handoff | a baton, passed only at merge in this repo | — |")
    .concat("\n## Airport terms\n\n| Term | Definition | Notes |\n|---|---|---|\n| gate | where you board | — |\n");
  const down = v1Downstream(up, { agents, context });
  const base = git(down, "rev-parse", "--short=12", "HEAD");

  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  const report = read(down, "gearbox-update-report.md");
  assert.match(report, /## ⚠️ v1 → v2 layout migration \(ADR-0050\)/);
  assert.match(report, /- Maintainer: `octo-owner`/);
  assert.match(report, /- Gate command: moved to `## Gate`/);
  assert.match(report, /### Subsections moved verbatim into `## Local protocol extensions`\n\n- \[ \] Worktree discipline \(project ADR-0149\) — /);
  assert.match(report, /- \[ \] From v1: While working — 1 line\(s\)/);
  assert.match(report, /### ⚠️ Subsections flagged for manual review[^\n]*\n[\s\S]*- \[ \] On ending a shift — 3\/3 unknown lines/);
  assert.ok(report.includes(`git show ${base}:AGENTS.md`), report);
  assert.match(report, /### Other top-level sections kept as they were\n\n- Runbook\n/);
  assert.match(report, /- \[ \] `gate` — [^\n]*product term/);
  assert.match(report, /- \[ \] [^\n]*edited locally[^\n]*`handoff`/);
  assert.match(report, /## Protocol check on this branch\n\n✅/);
  // The flagged subsection's lines aren't carried: the report is where they are named.
  assert.doesNotMatch(read(down, "AGENTS.md"), /Post a summary in the team channel/);
});

test("a moved index is appended to an existing docs/INDEX.md, never overwriting it", () => {
  const up = makeUpstream();
  const prior = "# Index\n\n- `app/` — the mobile app\n";
  const down = v1Downstream(up, { agents: AGENTS_V1.replace(INDEX_PLACEHOLDER, BIG_INDEX), files: { "docs/INDEX.md": prior } });
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  const index = read(down, "docs/INDEX.md");
  assert.ok(index.startsWith(`${prior}\n## Moved from AGENTS.md (Gearbox v2 migration)\n\n`), index.slice(0, 400));
  assert.ok(index.includes("- `src/module-1199.ts` — module 1199\n"));
  assert.equal(index.match(/^# /gm).length, 1);
  const agents = read(down, "AGENTS.md");
  assert.match(sectionBody(agents, 2, "Where to find things"), /`docs\/INDEX\.md`/);
  assert.doesNotMatch(agents, /module-1199/);
  assert.match(git(down, "log", "-1", "--format=%s", "--", "docs/INDEX.md"), /migrate to the Gearbox v2 layout/);
  assert.match(read(down, "gearbox-update-report.md"), /appended to the existing `docs\/INDEX\.md`/);
  const c = runTool("gearbox-check", [], { cwd: down });
  assert.equal(c.code, 0, c.out);
});

test("a moved index gets a new docs/INDEX.md; AGENTS.md still over budget is a TODO, not a refusal", () => {
  const up = makeUpstream();
  const runbook = Array.from({ length: 700 }, (_, i) => `- Step ${i}: restart worker ${i} and wait for its health check.`).join("\n");
  const agents = AGENTS_V1
    .replace(INDEX_PLACEHOLDER, BIG_INDEX)
    .replace("## Where to find things", `## Runbook\n\n${runbook}\n\n## Where to find things`);
  const down = v1Downstream(up, { agents });
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  const index = read(down, "docs/INDEX.md");
  assert.match(index, /^# Index\n\n> Moved out of AGENTS\.md by the Gearbox v2 migration/);
  assert.ok(index.includes("- `src/module-1199.ts` — module 1199\n"));
  const bytes = Buffer.byteLength(read(down, "AGENTS.md"));
  assert.ok(bytes > 32768, `AGENTS.md is ${bytes} bytes`);
  const report = read(down, "gearbox-update-report.md");
  assert.match(report, /moved to a new `docs\/INDEX\.md`/);
  assert.ok(report.includes(`- [ ] **AGENTS.md is still ${bytes} bytes (> 32768)**`), report);
  assert.match(report, /## Protocol check on this branch\n\n❌ \d+ problem\(s\)/);
});

// validateContext never sweeps untracked files into a commit, and neither may the recovery hint.
test("a failed migration commit names the migration's paths to finish by hand", () => {
  const up = makeUpstream();
  const down = v1Downstream(up);
  write(down, ".git/hooks/pre-commit", "#!/bin/sh\nexit 1\n");
  chmodSync(join(down, ".git/hooks/pre-commit"), 0o755);
  git(down, "config", "core.hooksPath", join(down, ".git/hooks")); // beats any global hooksPath
  const r = update(down, up);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /git operation failed/);
  assert.match(r.out, /git add -- AGENTS\.md CONTEXT\.md \.github\/workflows\/gearbox-check\.yml \.github\/workflows\/gearbox-sync\.yml \.gearbox-version\n/);
  assert.match(git(down, "rev-parse", "--abbrev-ref", "HEAD"), /^docs\/gearbox-backfill-/);
  assert.equal(git(down, "show", "main:AGENTS.md"), AGENTS_V1.trim());
});

// The mirror of the v2 path's "CONTEXT.md has no fence while AGENTS.md has one": migrating
// CONTEXT.md again would write a second glossary fence next to the first.
test("a glossary fence without a protocol fence is refused as a half-migrated tree", () => {
  const up = makeUpstream();
  const down = v1Downstream(up, { context: `${CONTEXT_V1}\n${findFence(read(up, "CONTEXT.md"), "glossary").block}\n` });
  const r = update(down, up);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /half-migrated/);
  assert.equal(git(down, "branch", "--list", BRANCHES), "");
  assert.equal(git(down, "status", "--porcelain"), "");
});

// Once the migration rewrites AGENTS.md, the v1 text survives only in git history (the report's
// `git show <base>:AGENTS.md`): a v1 file that was never committed would be lost. An untracked
// docs/INDEX.md would be swept whole into the migration commit — and untracked files never are (#92).
test("an uncommitted file the migration would rewrite is refused: AGENTS.md always, docs/INDEX.md when the index moves", () => {
  const up = makeUpstream();
  const down = v1Downstream(up);
  git(down, "rm", "-q", "--cached", "AGENTS.md");
  git(down, "commit", "-q", "-m", "untrack AGENTS.md");
  const r = update(down, up);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /AGENTS\.md isn't committed/);
  assert.equal(read(down, "AGENTS.md"), AGENTS_V1);
  assert.equal(git(down, "branch", "--list", BRANCHES), "");
  assert.equal(git(down, "rev-parse", "--abbrev-ref", "HEAD"), "main");

  const down2 = v1Downstream(up, { agents: AGENTS_V1.replace(INDEX_PLACEHOLDER, BIG_INDEX) });
  write(down2, "docs/INDEX.md", "# Index\n\n- scratch notes\n");
  const r2 = update(down2, up);
  assert.equal(r2.code, 1, r2.out);
  assert.match(r2.out, /docs\/INDEX\.md isn't committed/);
  assert.equal(read(down2, "docs/INDEX.md"), "# Index\n\n- scratch notes\n");
  assert.equal(git(down2, "branch", "--list", BRANCHES), "");
  assert.equal(git(down2, "status", "--porcelain"), "?? docs/INDEX.md");
});
