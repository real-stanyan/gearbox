import test from "node:test";
import assert from "node:assert/strict";
import { findFence } from "../scripts/lib/fence.js";
import { chmodSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO, makeUpstream, runTool, gitInit, git, tmp, read, write, commitAll, guardedOrigin, PROTOCOL, GLOSSARY } from "./helpers.js";

function v2Downstream(up, { autocrlf = false } = {}) {
  const down = tmp("gearbox-down-");
  gitInit(down);
  if (autocrlf) git(down, "config", "core.autocrlf", "true");
  const r = runTool("gearbox-install", [down, "--name", "demo", "--maintainer", "octo", "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 0, r.out);
  commitAll(down, "install");
  if (autocrlf) {
    // A Git for Windows clone: LF blobs in the index, CRLF files on disk, status clean.
    git(down, "rm", "-rq", "--cached", ".");
    git(down, "reset", "-q", "--hard");
    assert.match(read(down, ".github/workflows/gearbox-check.yml"), /\r\n/);
    assert.equal(git(down, "status", "--porcelain"), "");
  }
  return down;
}
const update = (down, up, args = []) => runTool("gearbox-update", ["--no-push", ...args], { cwd: down, env: { GEARBOX_DIR: up } });

// ADR-0052: the older-duplicates list is written on arrival only. A duplicate a v2 repo gains later is
// never recorded by update: it stays an error, and the report says so.
test("update never records a v2 repo's duplicate ADR IDs: they stay an error", () => {
  const down = v2Downstream(makeUpstream());
  write(down, "docs/adr/0334-a.md", "# a\n");
  write(down, "docs/adr/0334-b.md", "# b\n");
  commitAll(down, "two lanes numbered by habit");
  const r = update(down, makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- a new rule` }));
  assert.equal(r.code, 0, r.out);
  assert.ok(!existsSync(join(down, "docs/adr/older-duplicates.md")));
  assert.match(read(down, "gearbox-update-report.md"), /^- \[ \] docs\/adr: ADR-334 is used by 2 files: 0334-a\.md, 0334-b\.md — /m);
});

test("synced: nothing to do, no branch", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Nothing to do/);
  assert.equal(git(down, "branch", "--list", "docs/gearbox-backfill-*"), "");
});

test("behind: fences rewritten + stamp bumped on a backfill branch; check passes", () => {
  const down = v2Downstream(makeUpstream());
  const up2 = makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- a new rule` });
  const r = update(down, up2);
  assert.equal(r.code, 0, r.out);
  assert.match(git(down, "rev-parse", "--abbrev-ref", "HEAD"), /^docs\/gearbox-backfill-/);
  assert.equal(findFence(read(down, "AGENTS.md"), "protocol").version, "v2.1.0");
  assert.equal(read(down, ".gearbox-version").trim(), "v2.1.0");
  assert.match(read(down, "gearbox-update-report.md"), /## Protocol fences rewritten/);
  const c = runTool("gearbox-check", [], { cwd: down });
  assert.equal(c.code, 0, c.out);
});

test("behind: nothing outside the fences changes", () => {
  const down = v2Downstream(makeUpstream());
  write(down, "AGENTS.md", read(down, "AGENTS.md").replace("## Hard rules\n", "## Hard rules\n\n- A project rule.\n"));
  commitAll(down, "project rule");
  const outside = (file, name) => {
    const text = read(down, file);
    return text.replace(findFence(text, name).block, "<fence>");
  };
  const before = [outside("AGENTS.md", "protocol"), outside("CONTEXT.md", "glossary")];
  const up2 = makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- a new rule`, glossary: `${GLOSSARY}\n| lane | one shift + its claims | — |` });
  const r = update(down, up2);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual([outside("AGENTS.md", "protocol"), outside("CONTEXT.md", "glossary")], before);
  assert.equal(findFence(read(down, "CONTEXT.md"), "glossary").block, findFence(read(up2, "CONTEXT.md"), "glossary").block);
});

test("stamp-only lag is fixed even when fences and ADRs already match", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  write(down, ".gearbox-version", "v1.9.9\n");
  commitAll(down, "old stamp");
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  assert.equal(read(down, ".gearbox-version").trim(), "v2.0.0");
  assert.match(git(down, "log", "-1", "--format=%s"), /\.gearbox-version → v2\.0\.0/);
});

// One stamp parse: gitOps once compared the whole trimmed file ("v2.0.0" = current) while main
// read the first line ("" = stale) — exit 0 on an EMPTY backfill branch, and the check still red.
test("a malformed stamp is repaired with a stamp commit, never left on an empty branch", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  write(down, ".gearbox-version", "\nv2.0.0\n");
  commitAll(down, "stamp with a leading blank line");
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  assert.equal(read(down, ".gearbox-version"), "v2.0.0\n");
  assert.equal(git(down, "rev-list", "--count", "main..HEAD"), "1");
  assert.match(git(down, "log", "-1", "--format=%s"), /\.gearbox-version → v2\.0\.0/);
  const c = runTool("gearbox-check", [], { cwd: down });
  assert.equal(c.code, 0, c.out);
});

test("hand-edited fence: refused without --force, re-applied with it", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  write(down, "AGENTS.md", read(down, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  commitAll(down, "hand edit");
  const refused = update(down, up);
  assert.equal(refused.code, 1);
  assert.match(refused.out, /Hand-edited gearbox fence/);
  assert.match(refused.out, /--force/);
  const forced = update(down, up, ["--force"]);
  assert.equal(forced.code, 0, forced.out);
  assert.match(read(down, "AGENTS.md"), /Commit in small steps\./);
  assert.match(read(down, "gearbox-update-report.md"), /overwrote a hand edit/);
});

// fenceStatus says "behind" whenever the versions differ, in either direction; a stale local
// ~/Github/gearbox checkout must not silently downgrade a downstream's fences.
test("older upstream: refused, even with --force — a fence is never downgraded", () => {
  const down = v2Downstream(makeUpstream({ version: "v2.1.0" }));
  const stale = makeUpstream(); // v2.0.0
  for (const args of [[], ["--force"]]) {
    const r = update(down, stale, args);
    assert.equal(r.code, 1, r.out);
    assert.match(r.out, /older than this repo/);
    assert.equal(git(down, "branch", "--list", "docs/gearbox-backfill-*"), "");
  }
  assert.equal(findFence(read(down, "AGENTS.md"), "protocol").version, "v2.1.0");
  assert.equal(read(down, ".gearbox-version").trim(), "v2.1.0");
});

// Under npx, GEARBOX_DIR is the npm package (no .git): "git -C <dir> pull" can't work there.
test("downgrade hint: a package upstream points at npx, a git checkout at pull", () => {
  const down = v2Downstream(makeUpstream({ version: "v2.1.0" }));
  const stale = makeUpstream(); // v2.0.0, no .git — the shape of the npm package
  const pkg = update(down, stale);
  assert.equal(pkg.code, 1, pkg.out);
  assert.match(pkg.out, /gearbox-agents package .* is older than this repo/);
  assert.match(pkg.out, /npx -y gearbox-agents@2 update again once v2\.1\.0 or later is published/);
  assert.doesNotMatch(pkg.out, /git -C/);
  gitInit(stale);
  const checkout = update(down, stale);
  assert.equal(checkout.code, 1, checkout.out);
  assert.ok(checkout.out.includes(`git -C "${stale}" pull`), checkout.out);
});

// core.autocrlf=true: a byte compare of the CRLF gearbox-check.yml on disk planned a phantom
// refresh; `git add` staged nothing and `git commit` failed halfway through the sequence.
test("CRLF checkout, synced: nothing to do, no branch", () => {
  const up = makeUpstream();
  const down = v2Downstream(up, { autocrlf: true });
  const r = update(down, up);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Nothing to do/);
  assert.equal(git(down, "branch", "--list", "docs/gearbox-backfill-*"), "");
});

test("CRLF checkout, behind: completes with the stamp committed", () => {
  const down = v2Downstream(makeUpstream(), { autocrlf: true });
  const r = update(down, makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- a new rule` }));
  assert.equal(r.code, 0, r.out);
  assert.equal(git(down, "show", "HEAD:.gearbox-version"), "v2.1.0");
  assert.equal(findFence(git(down, "show", "HEAD:AGENTS.md"), "protocol").version, "v2.1.0");
  assert.equal(git(down, "status", "--porcelain"), "?? gearbox-update-report.md");
});

// --force-redo used to delete today's branch in the preflight, before any refusal had run.
test("--force-redo deletes today's branch only after every refusal has passed", () => {
  const down = v2Downstream(makeUpstream({ version: "v2.1.0" }));
  const today = `docs/gearbox-backfill-${new Date().toISOString().slice(0, 10)}`;
  git(down, "checkout", "-q", "-b", today);
  write(down, "notes.md", "manual work\n");
  commitAll(down, "manual work on today's branch");
  git(down, "checkout", "-q", "main");
  const stale = update(down, makeUpstream(), ["--force-redo"]);
  assert.equal(stale.code, 1, stale.out);
  assert.match(stale.out, /older than this repo/);
  assert.equal(git(down, "log", "-1", "--format=%s", today), "manual work on today's branch");
  write(down, "AGENTS.md", read(down, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  commitAll(down, "hand edit");
  const handEdited = update(down, makeUpstream({ version: "v2.1.0" }), ["--force-redo"]);
  assert.equal(handEdited.code, 1, handEdited.out);
  assert.match(handEdited.out, /Hand-edited gearbox fence/);
  assert.equal(git(down, "log", "-1", "--format=%s", today), "manual work on today's branch");
  const redone = update(down, makeUpstream({ version: "v2.2.0" }), ["--force-redo", "--force"]);
  assert.equal(redone.code, 0, redone.out);
  const rebuilt = git(down, "log", "--format=%s", `main..${today}`);
  assert.doesNotMatch(rebuilt, /manual work/);
  assert.match(rebuilt, /sync the gearbox fences → v2\.2\.0/);
});

test("after --force-redo, every push hint says --force-with-lease", () => {
  const down = v2Downstream(makeUpstream());
  git(down, "branch", `docs/gearbox-backfill-${new Date().toISOString().slice(0, 10)}`);
  // no --no-push: this repo has no origin, so the push fails — exit 1, git's reason, the retry command
  const r = runTool("gearbox-update", ["--force-redo"], { cwd: down, env: { GEARBOX_DIR: makeUpstream({ version: "v2.1.0" }) } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /'origin' does not appear to be a git repository/);
  assert.match(r.out, /retry the push:\n\s*git push --force-with-lease -u origin docs\/gearbox-backfill-/);
  assert.match(read(down, "gearbox-update-report.md"), /push the branch: `git push --force-with-lease -u origin docs\/gearbox-backfill-/);
});

// GitHub refuses a push made with the Actions GITHUB_TOKEN that creates or updates a workflow file.
// update printed a yellow line and exited 0 — a green sync job and no PR, every week. A failed push
// is a failure: exit 1, git's own reason, the retry command; the branch and the report are kept.
test("a rejected push exits 1 with git's reason and the retry command; the committed branch and the report stay", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  git(down, "rm", "-q", ".github/workflows/gearbox-check.yml");
  commitAll(down, "drop gearbox-check.yml");
  guardedOrigin(down);
  const r = runTool("gearbox-update", [], { cwd: down, env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /remote: refusing to allow a GitHub App to create or update workflow/);
  assert.match(r.out, /retry the push:\n\s*git push -u origin docs\/gearbox-backfill-\d{4}-\d{2}-\d{2}\n/);
  assert.doesNotMatch(r.out, /✓ done/);
  const today = git(down, "rev-parse", "--abbrev-ref", "HEAD");
  assert.match(today, /^docs\/gearbox-backfill-/);
  assert.match(git(down, "log", "-1", "--format=%s"), /gearbox-check\.yml added/);
  assert.equal(git(down, "ls-remote", "--heads", "origin", today), "");
  assert.match(read(down, "gearbox-update-report.md"), /push the branch: `git push -u origin docs\/gearbox-backfill-/);
});

// In GitHub Actions update never writes a workflow file (ADR-0051). When that is all there is to do,
// it makes no branch — the ::warning:: annotation is how the downstream learns it needs a local run.
test("in GitHub Actions, workflow changes alone make no branch: exit 0 and a ::warning:: naming the skipped file", () => {
  const up = makeUpstream();
  const down = v2Downstream(up);
  git(down, "rm", "-q", ".github/workflows/gearbox-check.yml");
  commitAll(down, "drop gearbox-check.yml");
  // the sync Action's exact invocation — no --no-push, and no origin: a push attempt would exit 1
  const r = runTool("gearbox-update", ["--refresh-drift"], { cwd: down, env: { GEARBOX_DIR: up, GITHUB_ACTIONS: "true" } });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^::warning::[^\n]*\.github\/workflows\/gearbox-check\.yml \(added\)[^\n]*run npx gearbox-agents@2 update locally/m);
  assert.equal(git(down, "branch", "--list", "docs/gearbox-backfill-*"), "");
  assert.equal(git(down, "status", "--porcelain"), "");
  assert.ok(!existsSync(join(down, ".github/workflows/gearbox-check.yml")));
});

// Branch first, files second: a branch step that fails (here: today's branch is checked out in
// another worktree, so --force-redo can't delete it) must not leave main's tree half-written.
test("a failing branch step leaves the working tree untouched", () => {
  const down = v2Downstream(makeUpstream());
  const today = `docs/gearbox-backfill-${new Date().toISOString().slice(0, 10)}`;
  git(down, "branch", today);
  git(down, "worktree", "add", "-q", join(tmp(), "wt"), today);
  const r = update(down, makeUpstream({ version: "v2.1.0" }), ["--force-redo"]);
  assert.equal(r.code, 1, r.out);
  assert.equal(git(down, "status", "--porcelain"), "");
  assert.equal(git(down, "rev-parse", "--abbrev-ref", "HEAD"), "main");
});

// validateContext never sweeps untracked files into a commit, and neither may the recovery hint.
test("a failed commit names the tool's own paths to finish by hand", () => {
  const down = v2Downstream(makeUpstream());
  write(down, ".git/hooks/pre-commit", "#!/bin/sh\nexit 1\n");
  chmodSync(join(down, ".git/hooks/pre-commit"), 0o755);
  git(down, "config", "core.hooksPath", join(down, ".git/hooks")); // beats any global hooksPath
  const r = update(down, makeUpstream({ version: "v2.1.0" }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /git operation failed/);
  assert.match(r.out, /git add -- AGENTS\.md CONTEXT\.md \.gearbox-version\n/);
  assert.doesNotMatch(r.out, /git add -A/);
  assert.match(git(down, "rev-parse", "--abbrev-ref", "HEAD"), /^docs\/gearbox-backfill-/);
});

// cmd.exe — the shell execSync uses on Windows — has no /dev/null: `2>/dev/null` fails the command
// there, so tryRun read today's branch as absent on every run and the same-day rerun died on
// `git checkout -b`. stdio is piped already, so no tool needs a redirect.
test("no tool shells out with a POSIX-only /dev/null redirect", () => {
  const files = [
    ...["gearbox-install", "gearbox-update", "gearbox-version", "gearbox-check", "gearbox-prune"].map((f) => join("scripts", f)),
    ...readdirSync(join(REPO, "scripts/lib")).filter((f) => f.endsWith(".js")).map((f) => join("scripts/lib", f)),
  ];
  for (const f of files) assert.doesNotMatch(readFileSync(join(REPO, f), "utf8"), /\/dev\/null/, f);
});
