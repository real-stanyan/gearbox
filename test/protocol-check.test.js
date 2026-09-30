import test from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { runProtocolChecks, gateCommand, maintainerAccount, AGENTS_MAX_BYTES, PROTOCOL_FENCE_MAX_BYTES } from "../scripts/lib/protocol-check.js";
import { renderFence, findFence, replaceFence } from "../scripts/lib/fence.js";
import { CHECK_YML } from "../scripts/lib/workflows.js";
import { v2Repo, write, read, gitInit, runTool, runBin, tmp, PROTOCOL } from "./helpers.js";

const errorsOf = (dir, opts) => runProtocolChecks(dir, opts).errors;

// Rewrite the protocol fence's content and re-render it, so the marker hash stays valid and
// only the assertion under test can fail.
function rewriteProtocol(dir, mutate) {
  const text = read(dir, "AGENTS.md");
  const fence = findFence(text, "protocol");
  write(dir, "AGENTS.md", replaceFence(text, "protocol", renderFence("protocol", fence.version, mutate(fence.content))));
}

// A v2 repo whose AGENTS.md is exactly `bytes` long (ASCII filler in "Where to find things").
function repoWithAgentsBytes(bytes) {
  const base = Buffer.byteLength(read(v2Repo({ whereToFind: "- x" }), "AGENTS.md"));
  const dir = v2Repo({ whereToFind: `- x${"x".repeat(bytes - base)}` });
  assert.equal(Buffer.byteLength(read(dir, "AGENTS.md")), bytes);
  return dir;
}

test("a clean v2 repo passes", () => {
  assert.deepEqual(errorsOf(v2Repo()), []);
});

test("a clean v2 repo has no warnings either", () => {
  assert.deepEqual(runProtocolChecks(v2Repo()).warnings, []);
});

test("a hand-edited fence is an error that names the fix", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  const errs = errorsOf(dir);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /edited by hand/);
  assert.match(errs[0], /update --force/);
});

test("the hash-mismatch fix names the mode's own tool: update --force downstream, rehash-fences.js upstream", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  const [down] = errorsOf(dir);
  assert.match(down, /"## Local protocol extensions"/);
  assert.match(down, /update --force/);
  assert.doesNotMatch(down, /rehash-fences/);
  const up = errorsOf(dir, { upstream: true });
  assert.equal(up.length, 1);
  assert.match(up[0], /`node scripts\/dev\/rehash-fences\.js`/);
  assert.doesNotMatch(up[0], /update --force/);
});

test("a hand-edited glossary fence is reported against CONTEXT.md and points at Project terms", () => {
  const dir = v2Repo();
  write(dir, "CONTEXT.md", read(dir, "CONTEXT.md").replace("a baton passed at merge", "whatever"));
  const errs = errorsOf(dir);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /^CONTEXT\.md: the gearbox:glossary fence was edited by hand/);
  assert.match(errs[0], /"## Project terms"/);
});

test(".gearbox-version must equal the fence version downstream, not upstream", () => {
  const dir = v2Repo({ stamp: "v1.15.0" });
  assert.match(errorsOf(dir).join("\n"), /\.gearbox-version is "v1\.15\.0"/);
  assert.deepEqual(errorsOf(dir, { upstream: true }), []);
});

test("a missing .gearbox-version is reported as (missing)", () => {
  assert.match(errorsOf(v2Repo({ stamp: null })).join("\n"), /\.gearbox-version is "\(missing\)"/);
});

test("the protocol and glossary fences must carry the same version", () => {
  const errs = errorsOf(v2Repo({ glossaryVersion: "v2.1.0" }));
  assert.equal(errs.length, 1);
  assert.match(errs[0], /fence versions differ: protocol v2\.0\.0, glossary v2\.1\.0/);
});

test("a missing fence is an error that names the fence", () => {
  const noProtocol = v2Repo();
  const agents = read(noProtocol, "AGENTS.md");
  write(noProtocol, "AGENTS.md", agents.replace(findFence(agents, "protocol").block, ""));
  const a = errorsOf(noProtocol);
  assert.equal(a.length, 1);
  assert.match(a[0], /AGENTS\.md has no gearbox:protocol fence/);

  const noGlossary = v2Repo();
  const context = read(noGlossary, "CONTEXT.md");
  write(noGlossary, "CONTEXT.md", context.replace(findFence(context, "glossary").block, ""));
  const c = errorsOf(noGlossary);
  assert.equal(c.length, 1);
  assert.match(c[0], /CONTEXT\.md has no gearbox:glossary fence/);

  // both gone is a v1 layout — update migrates it — one error per file; one gone is another case
  const neither = v2Repo();
  write(neither, "AGENTS.md", agents.replace(findFence(agents, "protocol").block, ""));
  write(neither, "CONTEXT.md", context.replace(findFence(context, "glossary").block, ""));
  const n = errorsOf(neither);
  assert.equal(n.length, 2);
  for (const e of n) assert.match(e, /has no gearbox:\w+ fence — run `npx gearbox-agents update` \(a v1 layout is migrated automatically/);
  assert.match(a[0], /^only one fence is present/);
});

test("duplicate and malformed markers are reported, not swallowed", () => {
  const dup = v2Repo();
  const agents = read(dup, "AGENTS.md");
  const begin = findFence(agents, "protocol").block.split("\n")[0];
  write(dup, "AGENTS.md", agents.replace(begin, `${begin}\n${begin}`));
  assert.match(errorsOf(dup).join("\n"), /AGENTS\.md: duplicate gearbox:protocol begin marker/);

  const bad = v2Repo();
  write(bad, "CONTEXT.md", read(bad, "CONTEXT.md").replace("gearbox:glossary v2.0.0", "gearbox:glossary v2.0"));
  assert.match(errorsOf(bad).join("\n"), /CONTEXT\.md: malformed gearbox marker/);
});

test("AGENTS.md over 32 KiB is an error listing the largest sections", () => {
  const dir = v2Repo({ whereToFind: `- ${"x".repeat(AGENTS_MAX_BYTES)}` });
  assert.match(errorsOf(dir).join("\n"), /over the 32768-byte budget.*Where to find things/);
});

test("the AGENTS.md budget counts UTF-8 bytes: the limit passes, one more fails, and the error points at docs/INDEX.md", () => {
  assert.deepEqual(errorsOf(repoWithAgentsBytes(AGENTS_MAX_BYTES)), []);
  const over = errorsOf(repoWithAgentsBytes(AGENTS_MAX_BYTES + 1));
  assert.equal(over.length, 1);
  assert.match(over[0], /AGENTS\.md is 32769 bytes, over the 32768-byte budget/);
  assert.match(over[0], /Largest sections: Where to find things \d+ B/);
  assert.match(over[0], /docs\/INDEX\.md/);
  // 16384 two-byte characters: under the limit as a character count, over it as bytes
  const multibyte = v2Repo({ whereToFind: `- ${"é".repeat(AGENTS_MAX_BYTES / 2)}` });
  assert.match(errorsOf(multibyte).join("\n"), /over the 32768-byte budget/);
});

// A Git for Windows checkout (core.autocrlf) has CRLF on disk, one byte more per line than the LF
// blob CI checks out: measured raw, a file near the limit failed locally while CI passed.
test("the AGENTS.md budget measures LF content: a CRLF checkout at the limit passes, as CI's LF checkout does", () => {
  const at = repoWithAgentsBytes(AGENTS_MAX_BYTES);
  write(at, "AGENTS.md", read(at, "AGENTS.md").replace(/\n/g, "\r\n"));
  assert.ok(Buffer.byteLength(read(at, "AGENTS.md")) > AGENTS_MAX_BYTES);
  assert.deepEqual(errorsOf(at), []);
  const over = repoWithAgentsBytes(AGENTS_MAX_BYTES + 1);
  write(over, "AGENTS.md", read(over, "AGENTS.md").replace(/\n/g, "\r\n"));
  assert.match(errorsOf(over).join("\n"), /AGENTS\.md is 32769 bytes, over the 32768-byte budget/);
});

test("missing project sections and missing fence headings are errors", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("## Maintainer\n", "## Owner\n"));
  assert.match(errorsOf(dir).join("\n"), /missing the project section "## Maintainer"/);
});

test("each required project section is enforced, as a level-2 heading", () => {
  for (const title of ["Tech stack", "Hard rules", "Gate", "Maintainer", "Local protocol extensions", "Where to find things"]) {
    for (const renamed of ["## Renamed\n", `### ${title}\n`]) {
      const dir = v2Repo();
      write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace(`## ${title}\n`, renamed));
      assert.match(errorsOf(dir).join("\n"), new RegExp(`missing the project section "## ${title}"`), `${title} -> ${renamed.trim()}`);
    }
  }
});

test("project sections are looked up outside the protocol fence only", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("## Maintainer\n", "## Owner\n"));
  rewriteProtocol(dir, (c) => `${c}\n\n## Maintainer\n\nGitHub account: \`smuggled\``);
  assert.match(errorsOf(dir).join("\n"), /missing the project section "## Maintainer"/);
});

// [heading line in helpers' PROTOCOL, the heading the error must name]
const REQUIRED_FENCE_HEADINGS = [
  ["## Working agreement (multi-agent)", "## Working agreement (multi-agent)"],
  ["### On starting a shift (the start-of-shift steps)", "### On starting a shift"],
  ["### While working", "### While working"],
  ["### Roles of issues & PRs", "### Roles of issues & PRs"],
  ["### PR disposition (merge rules)", "### PR disposition"],
  ["### Changing the protocol itself (rules for changing this file)", "### Changing the protocol itself"],
  ["### Gate contract (must be all-green before merge and shift-end)", "### Gate contract"],
  ["### On ending a shift (shift-end rules)", "### On ending a shift"],
];

test("each required fence heading is enforced", () => {
  for (const [line, missing] of REQUIRED_FENCE_HEADINGS) {
    assert.ok(PROTOCOL.includes(line), line);
    const dir = v2Repo();
    rewriteProtocol(dir, (c) => c.replace(line, line.replace(/^(#+) .*/, "$1 Renamed")));
    assert.deepEqual(errorsOf(dir), [`the protocol fence is missing "${missing}"`], line);
  }
});

test("fence headings match by exact base title: not by prefix, substring or level", () => {
  for (const renamed of ["### While working around bugs", "### Notes on While working", "## While working", "#### While working"]) {
    const dir = v2Repo();
    rewriteProtocol(dir, (c) => c.replace("### While working", renamed));
    assert.deepEqual(errorsOf(dir), ['the protocol fence is missing "### While working"'], renamed);
  }
});

test("CI must run every Gate line; trailing comments are ignored; placeholders fail", () => {
  assert.match(errorsOf(v2Repo({ ci: "jobs: {}\n" })).join("\n"), /doesn't run the Gate command line `npm test`/);
  const commented = v2Repo({ gate: "npm test   # offline suite\nnpm run lint", ci: "- run: npm test\n- run: npm run lint\n" });
  assert.deepEqual(errorsOf(commented), []);
  assert.match(errorsOf(v2Repo({ gate: "<gate command, e.g.: npm test>" })).join("\n"), /placeholder command/);
});

test("CI must run every line of a multi-line Gate, not just the first", () => {
  const dir = v2Repo({ gate: "npm test\nnpm run lint", ci: "- run: npm test\n" });
  assert.deepEqual(errorsOf(dir), [".github/workflows/ci.yml doesn't run the Gate command line `npm run lint` (CI == Gate contract)"]);
});

test("a Gate block's column-0 comments are not commands CI must run", () => {
  const dir = v2Repo({ gate: "# run everything\nnpm test", ci: "- run: npm test\n" });
  assert.deepEqual(errorsOf(dir), []);
});

test("a ~~~ Gate block is read, and an empty Gate block is an error", () => {
  const tilde = v2Repo();
  write(tilde, "AGENTS.md", read(tilde, "AGENTS.md").replace("```bash\nnpm test\n```", "~~~bash\nnpm test\n~~~"));
  assert.deepEqual(errorsOf(tilde), []);

  const empty = v2Repo();
  write(empty, "AGENTS.md", read(empty, "AGENTS.md").replace("```bash\nnpm test\n```", "```bash\n```"));
  assert.match(errorsOf(empty).join("\n"), /"## Gate" has no fenced command block/);
});

test("a missing CONTEXT.md or ci.yml is an error", () => {
  const noContext = v2Repo();
  rmSync(join(noContext, "CONTEXT.md"));
  assert.match(errorsOf(noContext).join("\n"), /CONTEXT\.md is missing/);

  const noCi = v2Repo();
  rmSync(join(noCi, ".github/workflows/ci.yml"));
  assert.match(errorsOf(noCi).join("\n"), /\.github\/workflows\/ci\.yml is missing/);
});

test("CLAUDE.md shell, HANDOFF.md and gitignored protocol files", () => {
  const dir = v2Repo();
  write(dir, "CLAUDE.md", "rules here\n");
  write(dir, "HANDOFF.md", "x\n");
  gitInit(dir);
  write(dir, ".gitignore", "CONTEXT.md\n");
  const all = errorsOf(dir).join("\n");
  assert.match(all, /CLAUDE\.md must be exactly '@AGENTS\.md'/);
  assert.match(all, /HANDOFF\.md must not exist/);
  assert.match(all, /must not be gitignored: CONTEXT\.md/);
});

test("every protocol file listed in ADR-0037 is checked against .gitignore", () => {
  for (const path of ["AGENTS.md", "CLAUDE.md", "CONTEXT.md", "docs/gearbox-adr", ".gearbox-version", ".github/workflows/ci.yml"]) {
    const dir = v2Repo();
    gitInit(dir);
    write(dir, ".gitignore", `${path}\n`);
    assert.match(errorsOf(dir).join("\n"), new RegExp(`must not be gitignored: ${path.replace(/[.]/g, "\\.")}`), path);
  }
});

test("warnings: placeholder maintainer, undecided / missing Upstream lines", () => {
  const dir = v2Repo({
    maintainer: null,
    localExtensions: "### Worktree discipline\n\n- Extends: While working\n- Upstream: undecided\n\nx\n\n### No upstream line\n\ny",
  });
  const { errors, warnings } = runProtocolChecks(dir);
  assert.deepEqual(errors, []);
  assert.match(warnings.join("\n"), /names no GitHub account/);
  assert.match(warnings.join("\n"), /"Worktree discipline" is "Upstream: undecided"/);
  assert.match(warnings.join("\n"), /"No upstream line" has no "- Upstream:" line/);
});

test("a Maintainer section without an account line warns too", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("GitHub account: `octo`", "TBD"));
  const { errors, warnings } = runProtocolChecks(dir);
  assert.deepEqual(errors, []);
  assert.match(warnings.join("\n"), /names no GitHub account/);
});

test("extension warnings ignore fenced text; an empty Upstream line counts as missing", () => {
  const dir = v2Repo({
    localExtensions: [
      "### Real extension", "", "- Extends: While working", "- Upstream: project-specific", "",
      "Template for the next one:", "", "```md", "### Example heading", "- Extends: x", "```", "",
      "### Empty upstream", "", "- Extends: While working", "- Upstream:", "", "Prose after the empty line.",
    ].join("\n"),
  });
  const { errors, warnings } = runProtocolChecks(dir);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, ['local extension "Empty upstream" has no "- Upstream:" line']);
});

test("the 20 KiB protocol-fence budget applies in upstream mode only, and exactly at the limit", () => {
  const repoWithFenceBytes = (bytes) => {
    const dir = v2Repo();
    rewriteProtocol(dir, () => `${PROTOCOL}\n\n${"z".repeat(bytes - Buffer.byteLength(PROTOCOL) - 2)}`);
    return dir;
  };
  assert.deepEqual(errorsOf(repoWithFenceBytes(PROTOCOL_FENCE_MAX_BYTES), { upstream: true }), []);
  const over = repoWithFenceBytes(PROTOCOL_FENCE_MAX_BYTES + 1);
  assert.match(errorsOf(over, { upstream: true }).join("\n"), /the protocol fence is 20481 bytes, over the 20480-byte upstream budget/);
  assert.doesNotMatch(errorsOf(over).join("\n"), /upstream budget/);
});

test("gateCommand and maintainerAccount read the project sections", () => {
  const md = read(v2Repo({ gate: "npm test  # x\nnpx tsc --noEmit" }), "AGENTS.md");
  assert.deepEqual(gateCommand(md), ["npm test", "npx tsc --noEmit"]);
  assert.equal(maintainerAccount(md), "octo");
});

test("gateCommand reads the first fenced block like CommonMark", () => {
  const gate = (...lines) => ["## Gate", "", ...lines, "", "> note", ""].join("\n");
  // a ~~~ block; comments (column 0 or trailing) go, along with the blank lines they leave
  assert.deepEqual(gateCommand(gate("~~~sh", "# run everything", "npm test  # fast", "", "npm run lint", "~~~")), ["npm test", "npm run lint"]);
  // only the first block counts
  assert.deepEqual(gateCommand(gate("```sh", "npm test", "```", "", "```sh", "echo later", "```")), ["npm test"]);
  // an empty first block is not glued to the next one
  assert.deepEqual(gateCommand(gate("```sh", "```", "", "```sh", "echo later", "```")), []);
  // another fence character, or a shorter run, is content — not a closer
  assert.deepEqual(gateCommand(gate("~~~sh", "echo a", "```", "echo b", "~~~")), ["echo a", "```", "echo b"]);
  assert.deepEqual(gateCommand(gate("````sh", "echo a", "```", "echo b", "````")), ["echo a", "```", "echo b"]);
  // no block, an unterminated block, no Gate section: null
  assert.equal(gateCommand("## Gate\n\nrun the tests\n"), null);
  assert.equal(gateCommand(gate("```sh", "npm test")), null);
  assert.equal(gateCommand("## Elsewhere\n\n```sh\nnpm test\n```\n"), null);
});

// CI can't run the protocol check once its workflow is gone, and a stale copy runs a stale check —
// but the sync Action can't write workflow files (ADR-0051): a warning pointing at a local update.
test("downstream: a missing or outdated gearbox-check.yml warns, never errors; CRLF is the same file; upstream mode doesn't look", () => {
  const missing = v2Repo();
  rmSync(join(missing, ".github/workflows/gearbox-check.yml"));
  const m = runProtocolChecks(missing);
  assert.deepEqual(m.errors, []);
  assert.deepEqual(m.warnings, [
    ".github/workflows/gearbox-check.yml is missing — run `npx gearbox-agents@2 update` locally to write it (the sync Action can't write workflow files, ADR-0051)",
  ]);
  assert.deepEqual(runProtocolChecks(missing, { upstream: true }).warnings, []);

  const outdated = v2Repo();
  write(outdated, ".github/workflows/gearbox-check.yml", CHECK_YML.replace("node-version: 24", "node-version: 20"));
  const o = runProtocolChecks(outdated);
  assert.deepEqual(o.errors, []);
  assert.match(o.warnings.join("\n"), /^\.github\/workflows\/gearbox-check\.yml differs from the template — run `npx gearbox-agents@2 update` locally/);

  const crlf = v2Repo();
  write(crlf, ".github/workflows/gearbox-check.yml", CHECK_YML.replace(/\n/g, "\r\n"));
  assert.deepEqual(runProtocolChecks(crlf).warnings, []);

  const cli = runTool("gearbox-check", [], { cwd: missing });
  assert.equal(cli.code, 0, cli.out);
  assert.match(cli.out, /⚠ \.github\/workflows\/gearbox-check\.yml is missing/);
});

test("gearbox-check CLI exits 0 on a clean repo and 1 with errors", () => {
  assert.equal(runTool("gearbox-check", [], { cwd: v2Repo() }).code, 0);
  const bad = runTool("gearbox-check", [], { cwd: tmp() });
  assert.equal(bad.code, 1);
  assert.match(bad.out, /AGENTS\.md is missing/);
});

// Every downstream's CI job runs `npx -y gearbox-agents@2 check`: bin/gearbox.js routes `check` to
// scripts/gearbox-check and passes its exit code through.
test("the npx entry point's check route: exit 0 on a clean repo, 1 with errors, warnings printed", () => {
  const ok = runBin(["check"], { cwd: v2Repo() });
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /✅ gearbox check passed/);
  const bad = runBin(["check"], { cwd: tmp() });
  assert.equal(bad.code, 1, bad.out);
  assert.match(bad.out, /gearbox check failed \(\d+\)[\s\S]*AGENTS\.md is missing/);
  const warned = runBin(["check"], { cwd: v2Repo({ maintainer: null }) });
  assert.equal(warned.code, 0, warned.out);
  assert.match(warned.out, /⚠ "## Maintainer" names no GitHub account/);
});

test("gearbox-check prints warnings without failing, counts its errors, and --help never runs the check", () => {
  const warned = runTool("gearbox-check", [], { cwd: v2Repo({ maintainer: null }) });
  assert.equal(warned.code, 0);
  assert.match(warned.out, /⚠ "## Maintainer" names no GitHub account/);
  assert.match(runTool("gearbox-check", [], { cwd: tmp() }).out, /gearbox check failed \(\d+\)/);
  const help = runTool("gearbox-check", ["--help"], { cwd: tmp() });
  assert.equal(help.code, 0);
  assert.match(help.out, /^gearbox-check — /);
});
