import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { AGENTS_MAX_BYTES } from "../scripts/lib/protocol-check.js";
import { makeUpstream, runTool, gitInit, tmp, read, write, commitAll, PROTOCOL, GLOSSARY } from "./helpers.js";

function installed(up) {
  const down = tmp("gearbox-ver-");
  gitInit(down);
  const r = runTool("gearbox-install", [down, "--name", "demo", "--maintainer", "octo", "--gate", "npm test"], { env: { GEARBOX_DIR: up } });
  assert.equal(r.code, 0, r.out);
  commitAll(down, "install");
  return down;
}
const version = (down, up, env = {}) => runTool("gearbox-version", [], { cwd: down, env: { GEARBOX_DIR: up, ...env } });

test("fully synced only when fences, ADRs and stamp all match", () => {
  const up = makeUpstream();
  const r = version(installed(up), up);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol synced/);
  assert.match(r.out, /fully synced/);
});

// The sync Action never writes workflow files (ADR-0051), so an unattended downstream gets them only
// from a local run — and version at shift start is the recurring signal to make it.
test("a workflow file update would write is never 'fully synced': the row names it and the local run", () => {
  const up = makeUpstream();
  const noCheck = installed(up);
  rmSync(join(noCheck, ".github/workflows/gearbox-check.yml"));
  commitAll(noCheck, "drop gearbox-check.yml"); // update refuses a dirty tree
  const r = version(noCheck, up);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol synced/);
  assert.match(r.out, /update would write \.github\/workflows\/gearbox-check\.yml \(added\) — run npx gearbox-agents@2 update locally \(the sync Action can't write workflow files\)/);
  assert.doesNotMatch(r.out, /fully synced/);
  // the advice works: a local update writes the file, and then the repo is fully synced
  const u = runTool("gearbox-update", ["--no-push"], { cwd: noCheck, env: { GEARBOX_DIR: up } });
  assert.equal(u.code, 0, u.out);
  assert.match(version(noCheck, up).out, /fully synced/);

  const stale = installed(up);
  write(stale, ".github/workflows/gearbox-sync.yml", read(stale, ".github/workflows/gearbox-sync.yml").replaceAll("gearbox-agents@2", "gearbox-agents@latest"));
  write(stale, ".github/workflows/gearbox-check.yml", `${read(stale, ".github/workflows/gearbox-check.yml")}# a local tweak\n`);
  const s = version(stale, up);
  assert.match(s.out, /update would write \.github\/workflows\/gearbox-check\.yml \(refreshed to the template\), \.github\/workflows\/gearbox-sync\.yml \(npx pin @latest → @2\)/);
  assert.doesNotMatch(s.out, /fully synced/);

  // CRLF on disk (core.autocrlf) is the same file
  const crlf = installed(up);
  for (const f of [".github/workflows/gearbox-check.yml", ".github/workflows/gearbox-sync.yml"]) write(crlf, f, read(crlf, f).replace(/\n/g, "\r\n"));
  const c = version(crlf, up);
  assert.doesNotMatch(c.out, /update would write/);
  assert.match(c.out, /fully synced/);
});

test("behind, hand-edited and v1 layout are each reported, never as fully synced", () => {
  const up = makeUpstream();
  const behind = version(installed(up), makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- new` }));
  assert.match(behind.out, /behind \(v2\.0\.0 → v2\.1\.0\)/);
  assert.doesNotMatch(behind.out, /fully synced/);

  const edited = installed(up);
  write(edited, "AGENTS.md", read(edited, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  const editedOut = version(edited, up).out;
  assert.match(editedOut, /hand-edited/);
  assert.doesNotMatch(editedOut, /fully synced/);

  const v1 = installed(up);
  write(v1, "AGENTS.md", "# old\n\n## Working agreement (multi-agent)\n");
  const v1Out = version(v1, up).out;
  assert.match(v1Out, /v1 layout/);
  assert.doesNotMatch(v1Out, /fully synced/);
});

test("warns when AGENTS.md is over the 32 KiB budget", () => {
  const up = makeUpstream();
  const down = installed(up);
  write(down, "AGENTS.md", read(down, "AGENTS.md") + `\n${"x".repeat(33000)}\n`);
  assert.match(version(down, up).out, /over the 32768-byte budget/);
});

// The size line measures what `check` measures — LF content — so a CRLF checkout (core.autocrlf)
// at the limit isn't told it's over while the check and CI pass.
test("the size line measures LF content, like the check: a CRLF AGENTS.md at the limit isn't over", () => {
  const up = makeUpstream();
  const down = installed(up);
  const text = read(down, "AGENTS.md");
  const atLimit = `${text}\n${"x".repeat(AGENTS_MAX_BYTES - Buffer.byteLength(text) - 2)}\n`;
  assert.equal(Buffer.byteLength(atLimit), AGENTS_MAX_BYTES);
  write(down, "AGENTS.md", atLimit.replace(/\n/g, "\r\n"));
  const r = version(down, up);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /over the 32768-byte budget/);
});

// fenceStatus says "behind" whenever the versions differ, in either direction. The tools default to
// a local ~/Github/gearbox checkout that may be stale, and `update` refuses to downgrade — so a
// local fence NEWER than upstream's must not read "behind" or advise running update.
test("a fence newer than upstream's is its own state: not 'behind', not 'fully synced', no 'run update'", () => {
  const down = installed(makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- new` }));
  const stale = makeUpstream(); // v2.0.0
  const r = version(down, stale);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol is NEWER than upstream \(v2\.1\.0 > v2\.0\.0\)/);
  assert.match(r.out, /CONTEXT\.md gearbox:glossary is NEWER than upstream \(v2\.1\.0 > v2\.0\.0\)/);
  assert.match(r.out, /your upstream gearbox is older; refresh it \(git pull \/ npx -y gearbox-agents@2\), don't run update/);
  assert.match(r.out, /upstream v2\.0\.0 \/ local v2\.1\.0 \(ahead of upstream\)/);
  assert.doesNotMatch(r.out, /fully synced/);
  assert.doesNotMatch(r.out, /behind/);
  assert.doesNotMatch(r.out, /run npx gearbox-agents update/);
  // "don't run update" is true: exactly this state is the one update refuses to act on
  const u = runTool("gearbox-update", ["--no-push"], { cwd: down, env: { GEARBOX_DIR: stale } });
  assert.equal(u.code, 1, u.out);
  assert.match(u.out, /older than this repo/);
});

test("a stale, missing or too-new .gearbox-version alone is never 'fully synced'", () => {
  const up = makeUpstream();
  const stale = installed(up);
  write(stale, ".gearbox-version", "v1.9.9\n");
  const s = version(stale, up);
  assert.equal(s.code, 0, s.out);
  assert.match(s.out, /AGENTS\.md gearbox:protocol synced/);
  assert.match(s.out, /\.gearbox-version v1\.9\.9 ≠ protocol v2\.0\.0 — run npx gearbox-agents update/);
  assert.doesNotMatch(s.out, /fully synced/);

  const none = installed(up);
  rmSync(join(none, ".gearbox-version"));
  const m = version(none, up);
  assert.equal(m.code, 0, m.out);
  assert.match(m.out, /\.gearbox-version \(missing\) ≠ protocol v2\.0\.0 — run npx gearbox-agents update/);
  assert.doesNotMatch(m.out, /fully synced/);

  // A stamp past the protocol version with the fences in sync is a bad stamp, not a stale upstream:
  // update rewrites it, so "don't run update" would be wrong advice here — and the advice given
  // must really work.
  const typo = installed(up);
  write(typo, ".gearbox-version", "v9.9.9\n");
  commitAll(typo, "typo'd stamp"); // update refuses a dirty tree
  const t = version(typo, up);
  assert.equal(t.code, 0, t.out);
  assert.match(t.out, /upstream v2\.0\.0 \/ local v9\.9\.9 \(ahead of upstream\)/);
  assert.match(t.out, /\.gearbox-version v9\.9\.9 ≠ protocol v2\.0\.0 — run npx gearbox-agents update/);
  assert.doesNotMatch(t.out, /fully synced/);
  const u = runTool("gearbox-update", ["--no-push"], { cwd: typo, env: { GEARBOX_DIR: up } });
  assert.equal(u.code, 0, u.out);
  assert.match(version(typo, up).out, /fully synced/);
});

test("an upstream without fences is reported, never 'fully synced'; the version falls back to the env/tag", () => {
  const down = installed(makeUpstream());
  const preV2 = makeUpstream();
  write(preV2, "AGENTS.md", "# Gearbox\n\n## Working agreement (multi-agent)\n");
  write(preV2, "CONTEXT.md", "# Domain context — Gearbox\n");
  const r = version(down, preV2, { GEARBOX_UPSTREAM_VERSION: "v1.9.0" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /upstream has no gearbox:protocol fence/);
  assert.match(r.out, /upstream v1\.9\.0 \/ local v2\.0\.0/);
  assert.doesNotMatch(r.out, /fully synced/);
});

// The ADR listing predates the fences and still counts: matching fences and stamp are not enough.
test("a missing or revised ADR still blocks 'fully synced' when the fences and stamp match", () => {
  const upMissing = makeUpstream();
  const downMissing = installed(upMissing);
  write(upMissing, "docs/gearbox-adr/0003-new-rule.md", "# ADR-0003: New rule\n\n- Date: 2026-09-29\n- Status: accepted\n");
  const missing = version(downMissing, upMissing);
  assert.match(missing.out, /AGENTS\.md gearbox:protocol synced/);
  assert.match(missing.out, /✖ ADR-0003/);
  assert.doesNotMatch(missing.out, /fully synced/);

  const upRevised = makeUpstream();
  const downRevised = installed(upRevised);
  write(upRevised, "docs/gearbox-adr/0002-self-check-as-gate.md", "# ADR-0002: Self-check as gate\n\n- Date: 2026-07-17\n- Status: accepted\n\nRevised upstream.\n");
  const revised = version(downRevised, upRevised);
  assert.match(revised.out, /AGENTS\.md gearbox:protocol synced/);
  assert.match(revised.out, /upstream has been revised/);
  assert.doesNotMatch(revised.out, /fully synced/);
});

test("a hand-edited fence names its own home: protocol rules vs glossary terms", () => {
  const up = makeUpstream();
  const down = installed(up);
  write(down, "AGENTS.md", read(down, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  write(down, "CONTEXT.md", read(down, "CONTEXT.md").replace("a baton passed at merge", "edited by hand"));
  const r = version(down, up);
  assert.match(r.out, /AGENTS\.md gearbox:protocol hand-edited — move local rules to "## Local protocol extensions", then npx gearbox-agents update --force/);
  assert.match(r.out, /CONTEXT\.md gearbox:glossary hand-edited — move local terms to "## Project terms", then npx gearbox-agents update --force/);
  assert.doesNotMatch(r.out, /fully synced/);
});

// update refuses a downgrade in EVERY fence state — "--force overrides hand edits, never a
// downgrade" — so a fence that is hand-edited AND newer than upstream's must not be told to
// "update --force", least of all next to a row saying NEWER.
test("a hand-edited fence that is also newer than upstream's is told to refresh upstream, not to force an update", () => {
  const editProtocol = (d) => write(d, "AGENTS.md", read(d, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  const editGlossary = (d) => write(d, "CONTEXT.md", read(d, "CONTEXT.md").replace("a baton passed at merge", "edited by hand"));
  const newer = () => makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- new` });
  const stale = makeUpstream(); // v2.0.0

  // only the protocol fence is hand-edited; the glossary row is plainly NEWER
  const one = installed(newer());
  editProtocol(one);
  commitAll(one, "hand edit");
  const r = version(one, stale);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol hand-edited, and NEWER than upstream \(v2\.1\.0 > v2\.0\.0\) — refresh your upstream first; update refuses to downgrade/);
  assert.match(r.out, /CONTEXT\.md gearbox:glossary is NEWER than upstream \(v2\.1\.0 > v2\.0\.0\)/);
  assert.doesNotMatch(r.out, /update --force/);
  assert.doesNotMatch(r.out, /fully synced/);
  // and the refusal is real: update won't do it even with --force
  const u = runTool("gearbox-update", ["--no-push", "--force"], { cwd: one, env: { GEARBOX_DIR: stale } });
  assert.equal(u.code, 1, u.out);
  assert.match(u.out, /older than this repo/);

  // both fences hand-edited: no row reads "ahead", yet the stamp advice must still not say "run update"
  const both = installed(newer());
  editProtocol(both);
  editGlossary(both);
  const b = version(both, stale);
  assert.equal(b.code, 0, b.out);
  assert.match(b.out, /CONTEXT\.md gearbox:glossary hand-edited, and NEWER than upstream \(v2\.1\.0 > v2\.0\.0\)/);
  assert.match(b.out, /\.gearbox-version v2\.1\.0 ≠ protocol v2\.0\.0 — your upstream gearbox is older; refresh it, don't run update/);
  assert.doesNotMatch(b.out, /update --force/);
  assert.doesNotMatch(b.out, /run npx gearbox-agents update/);
  assert.doesNotMatch(b.out, /fully synced/);
});

// Under npx GEARBOX_UPSTREAM_VERSION is the PACKAGE version (bin/gearbox.js always sets it), which
// moves independently of the protocol. fenceStatus throws on a malformed LOCAL marker before it
// hands upstream's fence back, so upstream's protocol version has to be read from upstream's own text.
test("a malformed local marker doesn't hide upstream's protocol version behind the package version", () => {
  const up = makeUpstream(); // protocol v2.0.0
  const down = installed(up);
  write(down, "AGENTS.md", read(down, "AGENTS.md").replace("<!-- /gearbox:protocol -->", ""));
  const r = version(down, up, { GEARBOX_UPSTREAM_VERSION: "v2.5.0" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol: .*has no end marker/);
  assert.match(r.out, /upstream v2\.0\.0 \/ local v2\.0\.0 \(in sync\)/);
  assert.doesNotMatch(r.out, /v2\.5\.0/);
  assert.doesNotMatch(r.out, /behind by/);
  assert.doesNotMatch(r.out, /run npx gearbox-agents update/);
  assert.doesNotMatch(r.out, /fully synced/);
});

// The same read of upstream's own text must survive a malformed UPSTREAM marker: an error row, not a crash.
test("a malformed upstream marker is an error row, not a crash; the version falls back to the env/tag", () => {
  const down = installed(makeUpstream());
  const broken = makeUpstream();
  write(broken, "AGENTS.md", read(broken, "AGENTS.md").replace("<!-- /gearbox:protocol -->", ""));
  const r = version(down, broken, { GEARBOX_UPSTREAM_VERSION: "v2.5.0" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol: .*has no end marker/);
  assert.match(r.out, /upstream v2\.5\.0 \/ local v2\.0\.0/);
  assert.doesNotMatch(r.out, /fully synced/);
});

// The script is a read-only quick check that exits 0 in every state: a file it can't read is an
// error row, not an uncaught stack trace (which also ended the run with exit 1).
test("a fence file that can't be read is an error row, not a crash (a directory where the file should be)", () => {
  const up = makeUpstream();
  for (const [file, row] of [["AGENTS.md", /AGENTS\.md gearbox:protocol: EISDIR/], ["CONTEXT.md", /CONTEXT\.md gearbox:glossary: EISDIR/]]) {
    const down = installed(up);
    rmSync(join(down, file));
    mkdirSync(join(down, file));
    const r = version(down, up);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, row);
    assert.doesNotMatch(r.out, /node:fs|at readFileSync/); // no stack trace
    assert.doesNotMatch(r.out, /fully synced/);
  }
});

test("a fence file with mode 000 is an error row, not a crash", (t) => {
  const up = makeUpstream();
  for (const [file, row] of [["AGENTS.md", /AGENTS\.md gearbox:protocol: EACCES/], ["CONTEXT.md", /CONTEXT\.md gearbox:glossary: EACCES/]]) {
    const down = installed(up);
    const path = join(down, file);
    chmodSync(path, 0o000);
    try {
      try {
        readFileSync(path);
        return t.skip("mode 000 doesn't stop reads here (root, or a platform without POSIX modes)");
      } catch {
        /* unreadable, as the test needs */
      }
      const r = version(down, up);
      assert.equal(r.code, 0, r.out);
      assert.match(r.out, row);
      assert.doesNotMatch(r.out, /node:fs|at readFileSync/);
      assert.doesNotMatch(r.out, /fully synced/);
    } finally {
      chmodSync(path, 0o644);
    }
  }
});

// Neither side's unreadable file may hide the other side's data: reading upstream first and
// throwing on its failure skipped AGENTS.md's size check, and reading the local file first hid
// upstream's protocol version behind the tag/env fallback.
test("an unreadable file on one side doesn't hide the other side's data", () => {
  // upstream's AGENTS.md unreadable: the local AGENTS.md is still measured against the budget
  const upBroken = makeUpstream();
  rmSync(join(upBroken, "AGENTS.md"));
  mkdirSync(join(upBroken, "AGENTS.md"));
  const big = installed(makeUpstream());
  write(big, "AGENTS.md", read(big, "AGENTS.md") + `\n${"x".repeat(33000)}\n`);
  const a = version(big, upBroken);
  assert.equal(a.code, 0, a.out);
  assert.match(a.out, /AGENTS\.md gearbox:protocol: EISDIR/);
  assert.match(a.out, /over the 32768-byte budget/);
  assert.doesNotMatch(a.out, /fully synced/);

  // the local AGENTS.md unreadable: upstream's protocol version still comes from upstream's fence
  const up = makeUpstream();
  const down = installed(up);
  rmSync(join(down, "AGENTS.md"));
  mkdirSync(join(down, "AGENTS.md"));
  const b = version(down, up, { GEARBOX_UPSTREAM_VERSION: "v2.5.0" });
  assert.equal(b.code, 0, b.out);
  assert.match(b.out, /AGENTS\.md gearbox:protocol: EISDIR/);
  assert.match(b.out, /upstream v2\.0\.0 \/ local v2\.0\.0 \(in sync\)/);
  assert.doesNotMatch(b.out, /v2\.5\.0/);
  assert.doesNotMatch(b.out, /run npx gearbox-agents update/);
});

// An error row used to say only what failed. It now names the broken side and what to do about it —
// and nothing else in the run may send the user to an `update` that dies on the same problem.
test("error row, upstream without fences (pre-v2): refresh the package/checkout; update really can't help", () => {
  const down = installed(makeUpstream());
  const preV2 = makeUpstream();
  write(preV2, "AGENTS.md", "# Gearbox\n\n## Working agreement (multi-agent)\n");
  write(preV2, "CONTEXT.md", "# Domain context — Gearbox\n");
  const r = version(down, preV2, { GEARBOX_UPSTREAM_VERSION: "v1.9.0" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol: upstream has no gearbox:protocol fence — your gearbox upstream predates v2 — refresh the package\/checkout \(npx -y gearbox-agents@2 \/ git pull\)/);
  assert.match(r.out, /CONTEXT\.md gearbox:glossary: upstream has no gearbox:glossary fence — your gearbox upstream predates v2/);
  assert.doesNotMatch(r.out, /fix the marker line/);
  // no protocol version to hold the stamp against: no stamp line, and no "run update" anywhere
  assert.doesNotMatch(r.out, /≠ protocol/);
  assert.doesNotMatch(r.out, /run npx gearbox-agents update/);
  assert.doesNotMatch(r.out, /fully synced/);
  // the remedy is the right one: update dies on this upstream
  const u = runTool("gearbox-update", ["--no-push"], { cwd: down, env: { GEARBOX_DIR: preV2 } });
  assert.equal(u.code, 1, u.out);
  assert.match(u.out, /Can't read the gearbox:protocol fence/);
});

test("error row, malformed local marker: fix the marker line by hand; update says the same", () => {
  const up = makeUpstream();
  const down = installed(up);
  write(down, "AGENTS.md", read(down, "AGENTS.md").replace("<!-- /gearbox:protocol -->", ""));
  commitAll(down, "broken marker"); // update refuses a dirty tree
  const r = version(down, up);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol: .*has no end marker — fix the marker line by hand \(it must match the gearbox marker grammar\)/);
  assert.doesNotMatch(r.out, /predates v2|refresh the package/);
  assert.doesNotMatch(r.out, /fully synced/);
  const u = runTool("gearbox-update", ["--no-push"], { cwd: down, env: { GEARBOX_DIR: up } });
  assert.equal(u.code, 1, u.out);
  assert.match(u.out, /must be fixed by hand/);
});

test("error row, unusable upstream fence (malformed or unreadable): refresh the upstream, don't hunt a local line", () => {
  const down = installed(makeUpstream());
  const malformed = makeUpstream();
  write(malformed, "AGENTS.md", read(malformed, "AGENTS.md").replace("<!-- /gearbox:protocol -->", ""));
  const m = version(down, malformed, { GEARBOX_UPSTREAM_VERSION: "v2.5.0" });
  assert.equal(m.code, 0, m.out);
  assert.match(m.out, /AGENTS\.md gearbox:protocol: .*has no end marker — upstream's fence can't be used — refresh the package\/checkout \(npx -y gearbox-agents@2 \/ git pull\)/);
  assert.doesNotMatch(m.out, /fix the marker line/);
  // upstream's protocol version is unknown, and the env is the PACKAGE version under npx: no stamp verdict
  assert.doesNotMatch(m.out, /≠ protocol/);
  assert.doesNotMatch(m.out, /run npx gearbox-agents update/);

  const unreadable = makeUpstream();
  rmSync(join(unreadable, "AGENTS.md"));
  mkdirSync(join(unreadable, "AGENTS.md"));
  const u = version(down, unreadable);
  assert.equal(u.code, 0, u.out);
  assert.match(u.out, /AGENTS\.md gearbox:protocol: EISDIR.* — upstream's fence can't be used — refresh the package\/checkout/);
  assert.doesNotMatch(u.out, /fix the marker line/);
});

// Both sides broken at once: the row names one problem, and its remedy must be for that one.
test("an error row's remedy is always for the problem its message names", () => {
  const preV2 = makeUpstream();
  write(preV2, "AGENTS.md", "# Gearbox\n\n## Working agreement (multi-agent)\n");
  write(preV2, "CONTEXT.md", "# Domain context — Gearbox\n");
  const down = installed(makeUpstream());
  rmSync(join(down, "AGENTS.md"));
  mkdirSync(join(down, "AGENTS.md"));
  const r = version(down, preV2);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md gearbox:protocol: EISDIR[^\n]*/);
  assert.doesNotMatch(r.out.match(/AGENTS\.md gearbox:protocol: EISDIR[^\n]*/)[0], /predates v2|refresh|fix the marker/);
  assert.match(r.out, /CONTEXT\.md gearbox:glossary: upstream has no gearbox:glossary fence — your gearbox upstream predates v2/);
});

// A run where one fence row says "refresh your upstream first" (NEWER, or an upstream that can't be
// used) can't also tell the OTHER row to run update — update refuses or dies there. The other row's
// advice keeps its place but waits: "refresh your upstream first, then …".
test("when one row says refresh first, the other rows' update advice waits for it", () => {
  const brokenAgents = (up) => write(up, "AGENTS.md", read(up, "AGENTS.md").replace("<!-- /gearbox:protocol -->", ""));

  // upstream's AGENTS.md can't be used; the local glossary is hand-edited
  const up1 = makeUpstream();
  brokenAgents(up1);
  const d1 = installed(makeUpstream());
  write(d1, "CONTEXT.md", read(d1, "CONTEXT.md").replace("a baton passed at merge", "edited by hand"));
  const r1 = version(d1, up1);
  assert.equal(r1.code, 0, r1.out);
  assert.match(r1.out, /AGENTS\.md gearbox:protocol: .* — upstream's fence can't be used — refresh the package\/checkout/);
  assert.match(r1.out, /CONTEXT\.md gearbox:glossary hand-edited — move local terms to "## Project terms", refresh your upstream first, then npx gearbox-agents update --force/);

  // ... the glossary is behind (upstream's glossary moved on)
  const up2 = makeUpstream({ version: "v2.1.0", glossary: `${GLOSSARY}\n| lane | one shift + its claims | — |` });
  brokenAgents(up2);
  const r2 = version(installed(makeUpstream()), up2);
  assert.match(r2.out, /CONTEXT\.md gearbox:glossary behind \(v2\.0\.0 → v2\.1\.0\) — refresh your upstream first, then run npx gearbox-agents update/);

  // a half-migrated repo: the protocol fence is gone (v1 layout) while the glossary is NEWER than upstream's
  const d3 = installed(makeUpstream({ version: "v2.1.0", protocol: `${PROTOCOL}\n- new` }));
  write(d3, "AGENTS.md", "# old\n\n## Working agreement (multi-agent)\n");
  const r3 = version(d3, makeUpstream());
  assert.match(r3.out, /AGENTS\.md has no gearbox:protocol fence \(v1 layout\) — refresh your upstream first, then run npx gearbox-agents update to migrate/);
  assert.match(r3.out, /CONTEXT\.md gearbox:glossary is NEWER than upstream/);

  for (const r of [r1, r2, r3]) {
    assert.equal(r.code, 0, r.out);
    assert.doesNotMatch(r.out, /fully synced/);
    // every "update" instruction on a fence: line in these runs comes with a "refresh your upstream first"
    const advising = r.out.split("\n").filter((l) => /fence:/.test(l) && /update( --force| to migrate)?\b/.test(l));
    assert.ok(advising.length > 0, r.out);
    for (const line of advising) assert.match(line, /refresh|don't run update|update refuses/, line);
  }
});
