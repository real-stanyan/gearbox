import test from "node:test";
import assert from "node:assert/strict";
import { runProtocolChecks, gateCommand, maintainerAccount, AGENTS_MAX_BYTES } from "../scripts/lib/protocol-check.js";
import { renderFence } from "../scripts/lib/fence.js";
import { v2Repo, write, read, gitInit, runTool, tmp, PROTOCOL } from "./helpers.js";

const errorsOf = (dir, opts) => runProtocolChecks(dir, opts).errors;

test("a clean v2 repo passes", () => {
  assert.deepEqual(errorsOf(v2Repo()), []);
});

test("a hand-edited fence is an error that names the fix", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("Commit in small steps.", "Commit whenever."));
  const errs = errorsOf(dir);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /edited by hand/);
  assert.match(errs[0], /update --force/);
});

test(".gearbox-version must equal the fence version downstream, not upstream", () => {
  const dir = v2Repo({ stamp: "v1.15.0" });
  assert.match(errorsOf(dir).join("\n"), /\.gearbox-version is "v1\.15\.0"/);
  assert.deepEqual(errorsOf(dir, { upstream: true }), []);
});

test("AGENTS.md over 32 KiB is an error listing the largest sections", () => {
  const dir = v2Repo({ whereToFind: `- ${"x".repeat(AGENTS_MAX_BYTES)}` });
  assert.match(errorsOf(dir).join("\n"), /over the 32768-byte budget.*Where to find things/);
});

test("missing project sections and missing fence headings are errors", () => {
  const dir = v2Repo();
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("## Maintainer\n", "## Owner\n"));
  assert.match(errorsOf(dir).join("\n"), /missing the project section "## Maintainer"/);
});

test("CI must run every Gate line; trailing comments are ignored; placeholders fail", () => {
  assert.match(errorsOf(v2Repo({ ci: "jobs: {}\n" })).join("\n"), /doesn't run the Gate command line `npm test`/);
  const commented = v2Repo({ gate: "npm test   # offline suite\nnpm run lint", ci: "- run: npm test\n- run: npm run lint\n" });
  assert.deepEqual(errorsOf(commented), []);
  assert.match(errorsOf(v2Repo({ gate: "<gate command, e.g.: npm test>" })).join("\n"), /placeholder command/);
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

test("upstream mode enforces the 20 KiB protocol-fence budget", () => {
  const dir = v2Repo();
  const agents = read(dir, "AGENTS.md");
  const big = renderFence("protocol", "v2.0.0", `${PROTOCOL}\n\n${"z".repeat(21000)}`);
  const start = agents.indexOf("<!-- gearbox:protocol");
  const end = agents.indexOf("<!-- /gearbox:protocol -->") + "<!-- /gearbox:protocol -->".length;
  write(dir, "AGENTS.md", agents.slice(0, start) + big + agents.slice(end));
  assert.match(errorsOf(dir, { upstream: true }).join("\n"), /20480-byte upstream budget/);
});

test("gateCommand and maintainerAccount read the project sections", () => {
  const md = read(v2Repo({ gate: "npm test  # x\nnpx tsc --noEmit" }), "AGENTS.md");
  assert.deepEqual(gateCommand(md), ["npm test", "npx tsc --noEmit"]);
  assert.equal(maintainerAccount(md), "octo");
});

test("gearbox-check CLI exits 0 on a clean repo and 1 with errors", () => {
  assert.equal(runTool("gearbox-check", [], { cwd: v2Repo() }).code, 0);
  const bad = runTool("gearbox-check", [], { cwd: tmp() });
  assert.equal(bad.code, 1);
  assert.match(bad.out, /AGENTS\.md is missing/);
});
