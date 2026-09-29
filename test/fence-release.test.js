import { test } from "node:test";
import assert from "node:assert/strict";
import { findFence, renderFence } from "../scripts/lib/fence.js";
import { latestTag, fencesAt, releaseState } from "../scripts/lib/fence-release.js";
import { tmp, write, read, git, gitInit, commitAll, runTool, gearboxRepo, restamp, setPackageVersion, editFence } from "./helpers.js";

// GitHub Actions sets CI=true, and a tagless checkout fails there by design; every run except
// the one that tests exactly that clears it.
const check = (dir, env = {}) => runTool("check-gearbox.js", [], { cwd: dir, env: { CI: "", ...env } });
const rehash = (dir) => runTool("dev/rehash-fences.js", [], { cwd: dir });
const markers = (dir) => [findFence(read(dir, "AGENTS.md"), "protocol").version, findFence(read(dir, "CONTEXT.md"), "glossary").version];
const current = (dir) => ({ protocol: findFence(read(dir, "AGENTS.md"), "protocol"), glossary: findFence(read(dir, "CONTEXT.md"), "glossary") });

test("a tagged release passes the upstream self-check as-is", () => {
  const r = check(gearboxRepo());
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Gearbox self-check passed/);
});

test("(a) unchanged fences + a README-only bump: rehash keeps v2.0.0 and the check passes", () => {
  const dir = gearboxRepo();
  setPackageVersion(dir, "2.0.1");
  write(dir, "README.md", `${read(dir, "README.md")}\nA README-only change.\n`);
  const r = rehash(dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /AGENTS\.md: gearbox:protocol v2\.0\.0 sha256:[0-9a-f]{12} \(unchanged\)/);
  assert.match(r.out, /CONTEXT\.md: gearbox:glossary v2\.0\.0 sha256:[0-9a-f]{12} \(unchanged\)/);
  assert.deepEqual(markers(dir), ["v2.0.0", "v2.0.0"]);
  const c = check(dir);
  assert.equal(c.code, 0, c.out);
  assert.deepEqual(releaseState(dir, current(dir), "v2.0.1"), {
    tag: "v2.0.0", changed: false, tagVersion: "v2.0.0", expected: "v2.0.0", bumped: true, errors: [],
  });
});

test("(b) a fence edit + a bump to 2.1.0: rehash stamps v2.1.0 on both markers and the check passes", () => {
  for (const [file, name] of [["AGENTS.md", "protocol"], ["CONTEXT.md", "glossary"]]) {
    const dir = gearboxRepo();
    editFence(dir, file, name);
    setPackageVersion(dir, "2.1.0");
    const r = rehash(dir);
    assert.equal(r.code, 0, r.out);
    assert.deepEqual(markers(dir), ["v2.1.0", "v2.1.0"], `${name} edit moves both markers`);
    const c = check(dir);
    assert.equal(c.code, 0, c.out);
  }
});

test("(c) a fence edit without a bump: rehash refuses and the version rule reports it", () => {
  const dir = gearboxRepo();
  editFence(dir);
  const before = read(dir, "AGENTS.md");
  const r = rehash(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /fence content changed since v2\.0\.0 — bump package\.json's version first \(ADR-0050\)/);
  assert.equal(read(dir, "AGENTS.md"), before, "a refused rehash writes nothing");
  const c = check(dir);
  assert.equal(c.code, 1, c.out);
  assert.match(c.out, /package\.json's version \(v2\.0\.0\) isn't greater than v2\.0\.0/);
  const s = releaseState(dir, current(dir), "v2.0.0");
  assert.equal(s.changed, true);
  assert.equal(s.bumped, false);
  assert.equal(s.errors.length, 1, "the marker already equals package.json's version — only the missing bump is wrong");
});

test("(d) unchanged fences with both markers hand-set to v9.9.9: the check fails, rehash restores v2.0.0", () => {
  const dir = gearboxRepo();
  restamp(dir, "v9.9.9");
  const c = check(dir);
  assert.equal(c.code, 1, c.out);
  assert.match(c.out, /fence content is unchanged since v2\.0\.0, so the marker version \(v9\.9\.9\) must stay v2\.0\.0/);
  const r = rehash(dir);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(markers(dir), ["v2.0.0", "v2.0.0"]);
  assert.equal(check(dir).code, 0);
});

test("(e) a stamp made before the bump is no dead end: after the bump, rehash moves the version", () => {
  const dir = gearboxRepo();
  editFence(dir);
  restamp(dir, "v2.0.0"); // what the pre-fix rehash wrote before the bump: new hash, old version
  let c = check(dir);
  assert.equal(c.code, 1, c.out);
  assert.match(c.out, /isn't greater than v2\.0\.0/);
  setPackageVersion(dir, "2.1.0");
  c = check(dir);
  assert.equal(c.code, 1, c.out);
  assert.match(c.out, /so the marker version \(v2\.0\.0\) must equal package\.json's \(v2\.1\.0\)/);
  const r = rehash(dir);
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /\(unchanged\)/, "the hashes already matched, yet rehash must move the version");
  assert.deepEqual(markers(dir), ["v2.1.0", "v2.1.0"]);
  c = check(dir);
  assert.equal(c.code, 0, c.out);
});

test("(e) the same order with the new rehash: refuse before the bump, stamp after it, end green", () => {
  const dir = gearboxRepo();
  editFence(dir);
  assert.equal(rehash(dir).code, 1);
  setPackageVersion(dir, "2.1.0");
  const r = rehash(dir);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(markers(dir), ["v2.1.0", "v2.1.0"]);
  const c = check(dir);
  assert.equal(c.code, 0, c.out);
});

test("(f) no tags: the version rule is skipped locally, and a tagless CI checkout fails", () => {
  const dir = gearboxRepo({ tag: false });
  editFence(dir);
  restamp(dir, "v2.0.0");
  assert.deepEqual(releaseState(dir, current(dir), "v2.0.0").errors, []);
  const local = check(dir);
  assert.equal(local.code, 0, local.out);
  const ci = check(dir, { CI: "true" });
  assert.equal(ci.code, 1, ci.out);
  assert.match(ci.out, /CI checkout has no tags — use fetch-depth: 0/);

  // rehash without a tag: content edited since the last stamp → package.json's version, else keep
  const edited = gearboxRepo({ tag: false });
  editFence(edited);
  setPackageVersion(edited, "2.1.0");
  assert.equal(rehash(edited).code, 0);
  assert.deepEqual(markers(edited), ["v2.1.0", "v2.1.0"]);
  const untouched = gearboxRepo({ tag: false });
  setPackageVersion(untouched, "2.0.1");
  assert.match(rehash(untouched).out, /v2\.0\.0 sha256:[0-9a-f]{12} \(unchanged\)/);
  assert.deepEqual(markers(untouched), ["v2.0.0", "v2.0.0"]);
});

test("latestTag picks the highest vX.Y.Z tag by version order; fencesAt is null-safe", () => {
  assert.equal(latestTag(tmp()), null, "outside git");
  assert.deepEqual(fencesAt(tmp(), "v1.0.0"), { protocol: null, glossary: null }, "outside git");

  const dir = tmp("gearbox-tags-");
  gitInit(dir);
  assert.equal(latestTag(dir), null, "no tags yet");
  write(dir, "AGENTS.md", "# v1 layout, no fence\n"); // and no CONTEXT.md at all
  commitAll(dir, "v1");
  for (const t of ["v1.9.0", "v1.10.0", "vnext", "v2.0.0-rc.1"]) git(dir, "tag", t);
  assert.equal(latestTag(dir), "v1.10.0", "version order, not string order; non-release tags ignored");
  assert.deepEqual(fencesAt(dir, "v1.10.0"), { protocol: null, glossary: null }, "no fence / missing file");

  const protocol = renderFence("protocol", "v2.0.0", "## Working agreement (multi-agent)");
  write(dir, "AGENTS.md", `# x\n\n${protocol}\n`);
  write(dir, "CONTEXT.md", `# y\n\n${renderFence("glossary", "v2.0.0", "## Protocol terms")}\n`);
  commitAll(dir, "v2");
  git(dir, "tag", "v2.0.0");
  const at = fencesAt(dir, "v2.0.0");
  assert.equal(latestTag(dir), "v2.0.0");
  assert.equal(at.protocol.version, "v2.0.0");
  assert.equal(at.glossary.version, "v2.0.0");

  const begin = protocol.split("\n")[0];
  write(dir, "AGENTS.md", `# x\n\n${begin}\n${protocol}\n`); // duplicate begin marker = malformed
  commitAll(dir, "malformed");
  git(dir, "tag", "v2.0.1");
  assert.equal(fencesAt(dir, "v2.0.1").protocol, null, "a malformed fence reads as null, never throws");
  assert.equal(fencesAt(dir, "--output=x").protocol, null, "an option-shaped ref is refused");
  assert.equal(fencesAt(dir, "v9.9.9").protocol, null, "an unknown ref");
});

test("an invalid package.json is a reported failure, not a crash", () => {
  const dir = gearboxRepo();
  write(dir, "package.json", "{ not json");
  const c = check(dir);
  assert.equal(c.code, 1, c.out);
  assert.match(c.out, /package\.json must be valid JSON/);
  assert.doesNotMatch(c.out, /SyntaxError|at JSON\.parse/);
});
