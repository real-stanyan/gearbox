import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, cpSync, existsSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { findFence } from "../scripts/lib/fence.js";
import { sectionBody } from "../scripts/lib/sections.js";
import { ciYml } from "../scripts/lib/workflows.js";
import { REPO, makeUpstream, runTool, gitInit, git, tmp, read, write, commitAll, guardedOrigin } from "./helpers.js";

// The real output of the v1.15.2 installer (--name example-project --maintainer octo-owner
// --gate "npm test"): Gearbox's own public template text, generated from the v1.15.2 tag.
const FX = join(REPO, "test/fixtures/v1.15.2-install");
const AGENTS_V1 = readFileSync(join(FX, "AGENTS.md"), "utf8");
const CONTEXT_V1 = readFileSync(join(FX, "CONTEXT.md"), "utf8");
const WHILE_WORKING = "- Commit in small steps; the message should spell out the **why**, not just the what";
const BRANCHES = "docs/gearbox-backfill-*";

// A v1 downstream as the v1.15.2 installer left it, committed on main. `files` adds paths; `sub`
// puts the downstream in a subdirectory of its git repo (a monorepo package).
function v1Downstream(up, { agents = AGENTS_V1, context = CONTEXT_V1, files = {}, sub = "" } = {}) {
  const root = tmp("gearbox-v1-");
  gitInit(root);
  const down = join(root, sub);
  write(down, "AGENTS.md", agents);
  write(down, "CONTEXT.md", context);
  write(down, "CLAUDE.md", "@AGENTS.md\n");
  write(down, ".github/workflows/ci.yml", ciYml("npm test"));
  write(down, ".github/workflows/gearbox-sync.yml", "run: npx -y gearbox-agents@latest update --refresh-drift\n");
  write(down, ".gearbox-version", "v1.15.2\n");
  cpSync(join(up, "docs/gearbox-adr"), join(down, "docs/gearbox-adr"), { recursive: true });
  for (const [rel, text] of Object.entries(files)) write(down, rel, text);
  commitAll(root, "a v1 downstream");
  return down;
}
const update = (down, up, args = []) => runTool("gearbox-update", ["--no-push", ...args], { cwd: down, env: { GEARBOX_DIR: up } });
// Enough "Where to find things" lines to push the assembled AGENTS.md past 32 KiB.
const BIG_INDEX = Array.from({ length: 1200 }, (_, i) => `- \`src/module-${i}.ts\` — module ${i}`).join("\n");
const INDEX_PLACEHOLDER = "- <other module documentation directories, e.g. docs/modules/>";
// "On ending a shift" rewritten in the project's own words: > 50% unknown lines, so the migration
// flags it for manual review instead of carrying it — the report is the only place it's named.
const rewriteShiftEnd = (text) =>
  text.replace(
    /(### On ending a shift \(shift-end rules\)\n\n)[\s\S]*?(\n\n### Parallel shifts)/,
    (_, head, tail) => `${head}1. Gate green, then push.\n2. Post a summary in the team channel.\n3. Close the lane's issues.${tail}`,
  );

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

// The sync Action's exact run (GITHUB_ACTIONS=true update --refresh-drift) on a v1 downstream. GitHub
// refuses a GITHUB_TOKEN push touching .github/workflows/, so the migration travels without the
// workflow files — each one a TODO for a local run after the merge, and a ::warning:: (ADR-0051).
test("in GitHub Actions, the migration is committed and pushed without any workflow file; each skipped one is a TODO and a ::warning::", () => {
  const up = makeUpstream();
  const down = v1Downstream(up);
  const origin = guardedOrigin(down);
  const r = runTool("gearbox-update", ["--refresh-drift"], { cwd: down, env: { GEARBOX_DIR: up, GITHUB_ACTIONS: "true" } });
  assert.equal(r.code, 0, r.out);
  const today = git(down, "rev-parse", "--abbrev-ref", "HEAD");
  assert.match(today, /^docs\/gearbox-backfill-/);
  assert.match(git(origin, "log", "--format=%s", today), /^docs\(protocol\): migrate to the Gearbox v2 layout/m);
  assert.equal(git(origin, "rev-parse", today), git(down, "rev-parse", "HEAD"));
  assert.ok(!existsSync(join(down, ".github/workflows/gearbox-check.yml")));
  assert.match(read(down, ".github/workflows/gearbox-sync.yml"), /gearbox-agents@latest/);
  assert.equal(git(down, "diff", "--name-only", "main", "HEAD", "--", ".github/workflows"), "");
  const report = read(down, "gearbox-update-report.md");
  const todo = "after merging, run `npx gearbox-agents@2 update` locally (the Actions token can't push workflow files)";
  assert.ok(report.includes(`- [ ] \`.github/workflows/gearbox-check.yml\` — added: ${todo}`), report);
  assert.ok(report.includes(`- [ ] \`.github/workflows/gearbox-sync.yml\` — npx pin @latest → @2: ${todo}`), report);
  assert.doesNotMatch(report, /push the branch/);
  assert.match(r.out, /^::warning::[^\n]*\.github\/workflows\/gearbox-check\.yml \(added\)[^\n]*npx gearbox-agents@2 update/m);
  assert.match(r.out, /^::warning::[^\n]*\.github\/workflows\/gearbox-sync\.yml \(npx pin @latest → @2\)[^\n]*npx gearbox-agents@2 update/m);
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
  const agents = rewriteShiftEnd(AGENTS_V1)
    .replace(WHILE_WORKING, `${WHILE_WORKING}\n- Search closed issues before claiming a task (project ADR-0148)`)
    .replace("### PR disposition (merge rules)", "### Worktree discipline (project ADR-0149)\n\n- One worktree per lane.\n\n### PR disposition (merge rules)")
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
  assert.ok(report.includes(`git show ${base}:./AGENTS.md`), report);
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

// A failed git operation must not lose the report: it's the only place a flagged (uncarried) v1
// subsection is named (spec §4). The recovery hint names only the tool's own paths — validateContext
// never sweeps untracked files into a commit, and neither may the hint.
test("a failed migration commit keeps the report and names the migration's paths to finish by hand", () => {
  const up = makeUpstream();
  const agents = rewriteShiftEnd(AGENTS_V1);
  const down = v1Downstream(up, { agents });
  write(down, ".git/hooks/pre-commit", "#!/bin/sh\nexit 1\n");
  chmodSync(join(down, ".git/hooks/pre-commit"), 0o755);
  git(down, "config", "core.hooksPath", join(down, ".git/hooks")); // beats any global hooksPath
  const r = update(down, up);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /flagged for manual review[^\n]*On ending a shift/);
  assert.match(r.out, /git operation failed/);
  const own = "AGENTS.md CONTEXT.md .github/workflows/gearbox-check.yml .github/workflows/gearbox-sync.yml .gearbox-version";
  assert.ok(r.out.includes(`git add -- ${own}\n`), r.out);
  assert.match(r.out, /--force-redo/);
  assert.match(git(down, "rev-parse", "--abbrev-ref", "HEAD"), /^docs\/gearbox-backfill-/);
  assert.equal(git(down, "show", "main:AGENTS.md"), agents.trim());
  assert.match(read(down, "gearbox-update-report.md"), /- \[ \] On ending a shift — 3\/3 unknown lines/);

  // Finished by hand, a rerun has nothing to do — and the report still names the flagged subsection.
  rmSync(join(down, ".git/hooks/pre-commit"));
  git(down, "add", "--", ...own.split(" "));
  git(down, "commit", "-q", "-m", "finish the migration by hand");
  const again = update(down, up);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /Nothing to do/);
  assert.match(read(down, "gearbox-update-report.md"), /- \[ \] On ending a shift — 3\/3 unknown lines/);
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

// A downstream can be a package in a subdirectory of its git repo: every path the tool hands to
// git must resolve from there, not from the repo root — the committed-file check, and the report's
// `git show <base>:…` (run from the downstream dir, where the report is).
test("a v1 downstream in a subdirectory of its git repo migrates, and the report's git show works from there", () => {
  const up = makeUpstream();
  const down = v1Downstream(up, { sub: "pkg" });
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  assert.ok(findFence(read(down, "AGENTS.md"), "protocol"));
  assert.equal(git(down, "show", "main:pkg/AGENTS.md"), AGENTS_V1.trim());
  const cmd = read(down, "gearbox-update-report.md").match(/`(git show [0-9a-f]+:\S+)`/)[1];
  assert.equal(execSync(cmd, { cwd: down, encoding: "utf8" }).trim(), AGENTS_V1.trim());
  const c = runTool("gearbox-check", [], { cwd: down });
  assert.equal(c.code, 0, c.out);
});

// The report lists only what the v1 file had: a section it lacked gets a v2 placeholder (a TODO),
// and with no gate command found, v1 gate notes are no "lines below the command".
test("the report's kept sections and gate line say only what the v1 file had", () => {
  const up = makeUpstream();
  const agents = AGENTS_V1
    .replace("## Tech stack\n\n<Project tech stack, one per line. Example: Next.js 15 / TypeScript / Postgres>\n\n", "")
    .replace("```bash\nnpm test\n```", "```bash\n<gate command, e.g.: npx tsc --noEmit && npx vitest run>\n```\n\n`npm test` also type-checks mobile/.");
  assert.doesNotMatch(agents, /## Tech stack/);
  const down = v1Downstream(up, { agents });
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  const report = read(down, "gearbox-update-report.md");
  assert.match(report, /^- Kept in place: the title and intro, `## Hard rules`, `## Where to find things` \(v1 template notes dropped\)$/m);
  assert.match(report, /^- \[ \] [^\n]*placeholder[^\n]*`## Tech stack`/m);
  assert.match(report, /^- \[ \] Gate command: \*\*not found\*\* — fill in `## Gate`[^\n]*$/m);
  assert.doesNotMatch(report, /below the command/);
  assert.match(sectionBody(read(down, "AGENTS.md"), 2, "Gate"), /also type-checks mobile/);
});

// No AGENTS.md at all isn't a v1 layout: it was never onboarded. Migrating it would make a
// titleless skeleton; install is the tool for that.
test("a repo with no AGENTS.md is refused, not migrated into a skeleton", () => {
  const up = makeUpstream();
  const down = v1Downstream(up);
  git(down, "rm", "-q", "AGENTS.md");
  git(down, "commit", "-q", "-m", "no AGENTS.md");
  const r = update(down, up);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no AGENTS\.md — this isn't an onboarded Gearbox repo; run npx gearbox-agents install instead/);
  assert.ok(!existsSync(join(down, "AGENTS.md")));
  assert.equal(git(down, "branch", "--list", BRANCHES), "");
  assert.equal(git(down, "status", "--porcelain"), "");
});

// The same-day paths (#96, ADR-0025) on a migration branch: a rerun resumes today's branch and
// finds nothing to do; --force-redo deletes it and rebuilds the same tree from main.
test("a same-day rerun resumes the migration branch with nothing to do; --force-redo rebuilds the same tree", () => {
  const up = makeUpstream();
  const down = v1Downstream(up);
  const first = update(down, up);
  assert.equal(first.code, 0, first.out);
  const today = git(down, "rev-parse", "--abbrev-ref", "HEAD");
  assert.match(today, /^docs\/gearbox-backfill-/);
  const tip = git(down, "rev-parse", today);
  const tree = git(down, "rev-parse", `${today}^{tree}`);

  git(down, "checkout", "-q", "main");
  const again = update(down, up);
  assert.equal(again.code, 0, again.out);
  assert.match(again.out, /resuming on docs\/gearbox-backfill-/);
  assert.match(again.out, /Nothing to do/);
  assert.equal(git(down, "rev-parse", today), tip);

  git(down, "checkout", "-q", "main");
  const redo = update(down, up, ["--force-redo"]);
  assert.equal(redo.code, 0, redo.out);
  assert.match(redo.out, /deleted[^\n]* the old docs\/gearbox-backfill-[^\n]* \(--force-redo\)/);
  assert.equal(git(down, "rev-parse", `${today}^{tree}`), tree);
  assert.match(git(down, "log", "--format=%s", `main..${today}`), /^docs\(protocol\): migrate to the Gearbox v2 layout/m);
  assert.equal(git(down, "rev-list", "--count", "main"), "1");
  assert.match(read(down, "gearbox-update-report.md"), /v1 → v2 layout migration/);
});

// The failure hint's paths are exact files, never a directory. `git clean -fd -- docs/gearbox-adr/`
// deleted a user's untracked ADR draft (unrecoverable), and — with nothing else in that directory
// tracked — the directory itself, so the --force-redo it recommended died on "no docs/gearbox-adr/".
// `git add -- docs/gearbox-adr/` would have swept the draft into the follow-up commit.
test("the start-over hint deletes only files this run created: a local ADR draft survives, --force-redo then succeeds", () => {
  const up = makeUpstream();
  const down = v1Downstream(up);
  git(down, "rm", "-rq", "docs/gearbox-adr");
  git(down, "commit", "-q", "-m", "no tracked protocol ADRs");
  const draft = "docs/gearbox-adr/0099-my-local-draft.md";
  write(down, draft, "# ADR-0099: My local draft\n\n- Status: proposed\n");
  write(down, ".git/hooks/pre-commit", "#!/bin/sh\nexit 1\n");
  chmodSync(join(down, ".git/hooks/pre-commit"), 0o755);
  git(down, "config", "core.hooksPath", join(down, ".git/hooks")); // beats any global hooksPath
  const r = update(down, up);
  assert.equal(r.code, 1, r.out);

  const lines = r.out.split("\n").map((l) => l.trim());
  const add = lines.find((l) => l.startsWith("git add -- "));
  assert.ok(add.split(" ").slice(3).every((p) => !p.endsWith("/")), add);
  assert.ok(add.includes("docs/gearbox-adr/0001-adr-template.md docs/gearbox-adr/0002-self-check-as-gate.md"), add);
  assert.ok(!add.includes(draft), add);
  const startOver = lines.slice(lines.findIndex((l) => l.startsWith("or start over")) + 1);
  const cmds = startOver.slice(0, startOver.indexOf(""));
  assert.equal(cmds.at(-1), "gearbox-update --force-redo");
  for (const cmd of cmds.slice(0, -1)) execSync(cmd, { cwd: down, stdio: "pipe" }); // verbatim

  assert.equal(read(down, draft), "# ADR-0099: My local draft\n\n- Status: proposed\n");
  assert.equal(git(down, "rev-parse", "--abbrev-ref", "HEAD"), "main");
  assert.equal(git(down, "status", "--porcelain", "--untracked-files=all"), `?? ${draft}\n?? gearbox-update-report.md`);
  rmSync(join(down, ".git/hooks/pre-commit"));
  const redo = update(down, up, ["--force-redo"]);
  assert.equal(redo.code, 0, redo.out);
  assert.equal(runTool("gearbox-check", [], { cwd: down }).code, 0);
  assert.equal(git(down, "ls-files", "--", draft), "");
  assert.equal(read(down, draft), "# ADR-0099: My local draft\n\n- Status: proposed\n");
});
