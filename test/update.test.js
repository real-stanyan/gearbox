import test from "node:test";
import assert from "node:assert/strict";
import { findFence } from "../scripts/lib/fence.js";
import { join } from "node:path";
import { makeUpstream, runTool, gitInit, git, tmp, read, write, commitAll, PROTOCOL, GLOSSARY } from "./helpers.js";

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
  // no --no-push: this repo has no origin, so the push fails and prints its hint
  const r = runTool("gearbox-update", ["--force-redo"], { cwd: down, env: { GEARBOX_DIR: makeUpstream({ version: "v2.1.0" }) } });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /push failed[^\n]*\n\s*git push --force-with-lease -u origin docs\/gearbox-backfill-/);
  assert.match(read(down, "gearbox-update-report.md"), /push the branch: `git push --force-with-lease -u origin docs\/gearbox-backfill-/);
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
